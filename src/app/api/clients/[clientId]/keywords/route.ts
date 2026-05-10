import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
  const body = await request.json();

  if (!body.keywords || !Array.isArray(body.keywords) || body.keywords.length === 0) {
    return NextResponse.json(
      { error: "keywords array is required" },
      { status: 400 }
    );
  }

  // Validate client exists
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Create keywords, skipping duplicates
  const results = [];
  const skipped = [];

  for (const kw of body.keywords) {
    const keyword = typeof kw === "string" ? kw.trim() : kw.keyword?.trim();
    if (!keyword) continue;

    try {
      const created = await prisma.keyword.create({
        data: {
          clientId,
          keyword,
          searchVolume: typeof kw === "object" ? kw.searchVolume || null : null,
          difficulty: typeof kw === "object" ? kw.difficulty || null : null,
          cpc: typeof kw === "object" && typeof kw.cpc === "number" ? kw.cpc : null,
          group: typeof kw === "object" ? kw.group || body.group || null : body.group || null,
          isTracking: true,
        },
      });
      results.push(created);
    } catch (err: unknown) {
      // Unique constraint violation — keyword already exists for this client
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
        skipped.push(keyword);
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
