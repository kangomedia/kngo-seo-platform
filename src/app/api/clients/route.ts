import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TIER_DEFAULTS } from "@/lib/tier-config";

export const dynamic = "force-dynamic";

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

  const body = await request.json();

  if (!body.name) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }

  if (!body.contactEmail) {
    return NextResponse.json({ error: "Contact email is required" }, { status: 400 });
  }

  const tier = body.tier || "STARTER";
  const defaults = TIER_DEFAULTS[tier] || TIER_DEFAULTS.STARTER;

  const client = await prisma.client.create({
    data: {
      name: body.name,
      contactName: body.contactName || body.name,
      contactEmail: body.contactEmail,
      domain: body.domain || null,
      tier,
      gbpCategory: body.category || null,
      city: body.city || null,
      state: body.state || null,
      serviceAreas: body.serviceAreas ? JSON.stringify(body.serviceAreas) : null,
      targetCities: body.targetCities ? JSON.stringify(body.targetCities) : null,
      competitors: body.competitors ? JSON.stringify(body.competitors) : null,
      onboardingStatus: body.domain ? "PENDING" : null,
      monthlyBlogs: defaults.monthlyBlogs,
      monthlyGbpPosts: defaults.monthlyGbpPosts,
      monthlyGbpQAs: defaults.monthlyGbpQAs,
      monthlyPressReleases: defaults.monthlyPressReleases,
      monthlyDirectoryListings: defaults.monthlyDirectoryListings,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
