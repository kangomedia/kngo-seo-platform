import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    where: { isActive: true },
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
      monthlyPressReleases: client.monthlyPressReleases,
      accessToken: client.accessToken,
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

  const client = await prisma.client.create({
    data: {
      name: body.name,
      domain: body.domain || null,
      tier: body.tier || "STARTER",
      monthlyBlogs: body.monthlyBlogs || 4,
      monthlyGbpPosts: body.monthlyGbpPosts || 8,
      monthlyPressReleases: body.monthlyPressReleases || 0,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
