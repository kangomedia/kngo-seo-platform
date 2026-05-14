import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TIER_DEFAULTS } from "@/lib/tier-config";
import { validateBody } from "@/lib/validate";

export const dynamic = "force-dynamic";

/**
 * Body schema for `POST /api/clients`. Single source of truth for what the
 * wizard (and any other caller) is allowed to send when creating a client.
 *
 * Notes on shape:
 * - JSON-column fields (serviceAreas, targetCities, brandTerms, etc.) come
 *   in as NATIVE ARRAYS, not pre-encoded JSON strings. They're encoded for
 *   storage in the handler. Callers that send a string for these (the audit's
 *   documented `brandTerms: "foo"` failure mode) get a 400 at the boundary.
 * - Optional strings use `nullish` so the wizard can send `null` or omit the
 *   field interchangeably without the schema rejecting it.
 */
const ClientCreateSchema = z.object({
  name: z.string().trim().min(1),
  contactName: z.string().trim().optional(),
  contactEmail: z.string().trim().email(),
  domain: z.string().trim().optional().nullable(),
  tier: z.enum(["STARTER", "GROWTH", "PRO"]).default("STARTER"),

  // Industry + location
  // `category` is a wizard-era alias that gets mapped to gbpCategory + falls
  // back to industryVertical when industryVertical is missing.
  category: z.string().trim().nullish(),
  industryVertical: z.string().trim().nullish(),
  industrySector: z.string().trim().nullish(),
  city: z.string().trim().nullish(),
  state: z.string().trim().nullish(),
  priceRange: z.enum(["budget", "mid-range", "premium", "enterprise"]).nullish(),

  // GBP profile fields
  gbpName: z.string().trim().nullish(),
  gbpUrl: z.string().trim().nullish(),
  gbpPhone: z.string().trim().nullish(),
  gbpAddress: z.string().trim().nullish(),

  // Crawl config
  sitemapUrl: z.string().trim().nullish(),

  // JSON-column arrays — see comment on schema above
  serviceAreas: z.array(z.string().trim().min(1)).default([]),
  primaryServices: z.array(z.string().trim().min(1)).default([]),
  targetCities: z.array(z.string().trim().min(1)).default([]),
  competitors: z.array(z.string().trim().min(1)).default([]),
  brandTerms: z.array(z.string().trim().min(1)).default([]),
  icpPains: z.array(z.string().trim().min(1)).default([]),

  // Free-form profile depth
  businessDescription: z.string().trim().nullish(),
  idealClientProfile: z.string().trim().nullish(),
});

type ClientCreateBody = z.infer<typeof ClientCreateSchema>;

export async function GET(request: Request) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // "archived" or default (active)

  const clients = await prisma.client.findMany({
    where: { isActive: status === "archived" ? false : true },
    orderBy: { name: "asc" },
    include: {
      keywords: {
        where: { isTracking: true },
        include: {
          snapshots: {
            orderBy: { checkedAt: "desc" },
            take: 1,
          },
        },
      },
      contentPlans: {
        include: { pieces: true },
      },
      deliverables: true,
    },
  });

  // Compute metrics for each client
  const clientsWithMetrics = clients.map((client) => {
    const keywords = client.keywords;
    const latestPositions = keywords
      .map((kw) => kw.snapshots[0]?.position)
      .filter((p): p is number => p !== null && p !== undefined);

    const page1Keywords = latestPositions.filter((p) => p <= 10).length;
    const avgPosition = latestPositions.length > 0
      ? Math.round((latestPositions.reduce((a, b) => a + b, 0) / latestPositions.length) * 10) / 10
      : 0;

    // Position change (compare current vs previous)
    const posChanges = keywords
      .map((kw) => {
        const snap = kw.snapshots[0];
        if (snap?.position && snap?.previousPos) {
          return snap.previousPos - snap.position; // positive = improved
        }
        return null;
      })
      .filter((c): c is number => c !== null);

    const avgPositionChange = posChanges.length > 0
      ? Math.round((posChanges.reduce((a, b) => a + b, 0) / posChanges.length) * 10) / 10
      : 0;

    // Content published count
    const contentPublished = client.contentPlans
      .flatMap((cp) => cp.pieces)
      .filter((p) => p.status === "PUBLISHED").length;

    // Health score (0-100 composite)
    const keywordScore = Math.min(100, (page1Keywords / Math.max(keywords.length, 1)) * 100);
    const deliverableTotal = client.deliverables.length;
    const deliverableCompleted = client.deliverables.filter((d) => d.status === "COMPLETED").length;
    const deliverableScore = deliverableTotal > 0 ? (deliverableCompleted / deliverableTotal) * 100 : 50;
    const healthScore = Math.round((keywordScore * 0.6 + deliverableScore * 0.4));

    return {
      id: client.id,
      name: client.name,
      domain: client.domain,
      tier: client.tier,
      logoUrl: client.logoUrl,
      monthlyBlogs: client.monthlyBlogs,
      monthlyGbpPosts: client.monthlyGbpPosts,
      monthlyGbpQAs: client.monthlyGbpQAs,
      monthlyPressReleases: client.monthlyPressReleases,
      monthlyDirectoryListings: client.monthlyDirectoryListings,
      accessToken: client.accessToken,
      onboardingStatus: client.onboardingStatus,
      metrics: {
        keywordsTracked: keywords.length,
        avgPosition,
        avgPositionChange: -avgPositionChange, // negative = improved in UI convention
        page1Keywords,
        page1Change: 0, // would need historical comparison
        contentPublished,
        healthScore,
      },
    };
  });

  return NextResponse.json(clientsWithMetrics);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validated = await validateBody(request, ClientCreateSchema);
  if (validated instanceof NextResponse) return validated;
  const body: ClientCreateBody = validated;

  const defaults = TIER_DEFAULTS[body.tier] || TIER_DEFAULTS.STARTER;

  // Encode validated arrays as JSON strings for storage. Native arrays go in,
  // JSON strings go out — and parsers.ts decodes them on the way back. The
  // arrays are already shape-validated by the Zod schema, so the only thing
  // happening here is encoding.
  const encodeArray = (arr: string[]): string | null =>
    arr.length > 0 ? JSON.stringify(arr) : null;

  const client = await prisma.client.create({
    data: {
      name: body.name,
      contactName: body.contactName || body.name,
      contactEmail: body.contactEmail,
      domain: body.domain || null,
      tier: body.tier,
      gbpCategory: body.category || null,
      gbpName: body.gbpName || null,
      gbpUrl: body.gbpUrl || null,
      gbpPhone: body.gbpPhone || null,
      gbpAddress: body.gbpAddress || null,
      sitemapUrl: body.sitemapUrl || null,
      brandTerms: encodeArray(body.brandTerms),
      city: body.city || null,
      state: body.state || null,
      // serviceAreas = geographic regions; primaryServices = actual services
      // sold. Distinct fields, distinct semantics — the schema enforces it.
      serviceAreas: encodeArray(body.serviceAreas),
      primaryServices: encodeArray(body.primaryServices),
      targetCities: encodeArray(body.targetCities),
      competitors: encodeArray(body.competitors),
      businessDescription: body.businessDescription || null,
      idealClientProfile: body.idealClientProfile || null,
      icpPains: encodeArray(body.icpPains),
      industryVertical: body.industryVertical || body.category || null,
      industrySector: body.industrySector || null,
      priceRange: body.priceRange || null,
      onboardingStatus: body.domain ? "PENDING" : null,
      monthlyBlogs: defaults.monthlyBlogs,
      monthlyGbpPosts: defaults.monthlyGbpPosts,
      monthlyGbpQAs: defaults.monthlyGbpQAs,
      monthlyPressReleases: defaults.monthlyPressReleases,
      monthlyDirectoryListings: defaults.monthlyDirectoryListings,
    },
  });

  // Mirror wizard-supplied competitors into the structured Competitor table.
  // The legacy Client.competitors JSON column is kept for read-back compat
  // until the table migration is finished and the column is dropped.
  for (const raw of body.competitors) {
    const domain = raw.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
    if (!domain) continue;
    try {
      await prisma.competitor.upsert({
        where: { clientId_domain: { clientId: client.id, domain } },
        create: {
          clientId: client.id,
          domain,
          classification: "PEER",
          isAccepted: true,
          source: "wizard",
        },
        update: {},
      });
    } catch (err) {
      console.warn("[clients POST] competitor upsert failed", domain, err);
    }
  }

  return NextResponse.json(client, { status: 201 });
}
