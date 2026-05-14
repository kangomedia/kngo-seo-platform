import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validateBody } from "@/lib/validate";

/**
 * Body schema for `POST /api/clients/[clientId]/keywords`.
 *
 * Each keyword can be a bare string OR a full metrics object. The 80-char
 * `max` on the keyword text is load-bearing: DataForSEO's `search_volume`
 * endpoint rejects keywords longer than ~80 chars with a 40501. Without this
 * cap, a stray long pain-point seed (the audit-flagged regression from
 * 2026-05-11) silently fails to fetch metrics — the keyword gets created
 * but stays metrics-less, with the error only visible in DataForSEO's log.
 */
const KeywordObjectSchema = z.object({
  keyword: z.string().trim().min(1).max(80),
  searchVolume: z.number().int().min(0).nullish(),
  difficulty: z.number().int().min(0).max(100).nullish(),
  cpc: z.number().min(0).nullish(),
  group: z.string().trim().nullish(),
});

const KeywordsPostSchema = z.object({
  keywords: z
    .array(
      z.union([
        z.string().trim().min(1).max(80),
        KeywordObjectSchema,
      ]),
    )
    .min(1, "At least one keyword is required"),
  /** Fallback group applied to any keyword that doesn't specify its own. */
  group: z.string().trim().nullish(),
});

type KeywordInput = z.infer<typeof KeywordsPostSchema>["keywords"][number];

// GET — list tracked keywords for a client. Used by the Discovery card on
// the client overview to know which suggested keywords are already tracked
// (so the button can render "Tracked" instead of "+ Track" on refresh).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" &&
      session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const keywords = await prisma.keyword.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: {
      snapshots: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({ keywords });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" &&
      session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const validated = await validateBody(request, KeywordsPostSchema);
  if (validated instanceof NextResponse) return validated;
  const body = validated;

  // Validate client exists
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Create keywords, skipping duplicates. The schema already trimmed strings,
  // validated max length, and ensured numbers are non-negative — so the
  // handler can read fields by shape without runtime type-tests.
  const results = [];
  const skipped: string[] = [];

  const extractFields = (kw: KeywordInput) =>
    typeof kw === "string"
      ? { keyword: kw, searchVolume: null, difficulty: null, cpc: null, group: null }
      : {
          keyword: kw.keyword,
          searchVolume: kw.searchVolume ?? null,
          difficulty: kw.difficulty ?? null,
          cpc: kw.cpc ?? null,
          group: kw.group ?? null,
        };

  for (const kw of body.keywords) {
    const fields = extractFields(kw);
    if (!fields.keyword) continue;

    try {
      const created = await prisma.keyword.create({
        data: {
          clientId,
          keyword: fields.keyword,
          searchVolume: fields.searchVolume,
          difficulty: fields.difficulty,
          cpc: fields.cpc,
          group: fields.group ?? body.group ?? null,
          isTracking: true,
        },
      });
      results.push(created);
    } catch (err: unknown) {
      // Unique constraint violation — keyword already exists for this client
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
        skipped.push(fields.keyword);
      } else {
        throw err;
      }
    }
  }

  // Fetch search volume from DataForSEO for newly created keywords
  if (results.length > 0) {
    try {
      const metrics = await fetchSearchVolume(results.map((r) => r.keyword));
      
      // Update each keyword with its metrics
      for (const result of results) {
        const metric = metrics.find(
          (m: { keyword: string }) => m.keyword?.toLowerCase() === result.keyword.toLowerCase()
        );
        if (metric) {
          await prisma.keyword.update({
            where: { id: result.id },
            data: {
              searchVolume: metric.search_volume || null,
              difficulty: metric.competition_level
                ? Math.round(metric.competition_level * 100)
                : null,
              // Persist CPC. Only overwrite if DataForSEO returned a real value
              // — preserves the value already supplied by the caller otherwise.
              ...(typeof metric.cpc === "number" ? { cpc: metric.cpc } : {}),
            },
          });
          // Also seed the per-query CPC cache used by traffic-value math.
          if (typeof metric.cpc === "number") {
            try {
              await prisma.keywordCpc.upsert({
                where: {
                  keyword_locationCode: {
                    keyword: result.keyword.toLowerCase(),
                    locationCode: 2840,
                  },
                },
                create: {
                  keyword: result.keyword.toLowerCase(),
                  locationCode: 2840,
                  cpc: metric.cpc,
                  searchVolume: metric.search_volume || null,
                  competition: metric.competition_level || null,
                },
                update: {
                  cpc: metric.cpc,
                  searchVolume: metric.search_volume || null,
                  competition: metric.competition_level || null,
                  fetchedAt: new Date(),
                },
              });
            } catch {
              /* cache write is best-effort */
            }
          }
        }
      }
    } catch (err) {
      // DataForSEO not configured or API error — keywords still created, just without metrics
      console.warn("[KEYWORDS] Could not fetch search volume:", err instanceof Error ? err.message : err);
    }
  }

  // Re-fetch keywords with updated metrics
  const updatedKeywords = await prisma.keyword.findMany({
    where: { id: { in: results.map((r) => r.id) } },
  });

  return NextResponse.json({
    created: updatedKeywords,
    skipped,
    message: `Added ${results.length} keywords${skipped.length > 0 ? `, ${skipped.length} already existed` : ""}`,
  });
}

/** Fetch search volume from DataForSEO */
async function fetchSearchVolume(keywords: string[]) {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables must be set.");
  }

  const encoded = Buffer.from(`${login}:${password}`).toString("base64");

  const response = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encoded}`,
      },
      body: JSON.stringify([
        {
          keywords,
          location_code: 2840, // United States
          language_code: "en",
        },
      ]),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DataForSEO error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data?.tasks?.[0]?.result || [];
}
