import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
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
  const url = new URL(request.url);
  const showArchived = url.searchParams.get("archived") === "true";

  const reports = await prisma.report.findMany({
    where: {
      clientId,
      ...(showArchived ? {} : { isArchived: false }),
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(reports);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  // Get everything about this client
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      keywords: {
        where: { isTracking: true },
        include: {
          snapshots: { orderBy: { checkedAt: "desc" }, take: 2 },
        },
      },
      contentPlans: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 1,
        include: {
          pieces: true,
        },
      },
      deliverables: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Accept optional month/year from request body
  let bodyData: { month?: number; year?: number } = {};
  try {
    bodyData = await request.json();
  } catch {
    // No body — use current month
  }

  const now = new Date();
  const month = bodyData.month || now.getMonth() + 1;
  const year = bodyData.year || now.getFullYear();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // ── Build keywords data ──
  const keywordsData = client.keywords.map((kw) => {
    const current = kw.snapshots[0]?.position ?? null;
    const previous = kw.snapshots[1]?.position ?? kw.snapshots[0]?.previousPos ?? null;
    const change = current != null && previous != null ? previous - current : null;

    return {
      keyword: kw.keyword,
      position: current,
      previousPosition: previous,
      change,
      searchVolume: kw.searchVolume ?? 0,
      difficulty: kw.difficulty ?? 0,
      group: kw.group || "General",
      url: kw.snapshots[0]?.url || null,
    };
  });

  // ── Compute stats ──
  const totalKeywords = keywordsData.length;
  const rankedKeywords = keywordsData.filter((k) => k.position != null);
  const page1Keywords = rankedKeywords.filter((k) => k.position! <= 10);
  const page2Keywords = rankedKeywords.filter((k) => k.position! > 10 && k.position! <= 20);

  const positions = rankedKeywords.map((k) => k.position!);
  const avgPosition = positions.length > 0
    ? Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1))
    : null;

  const totalSearchVolume = keywordsData.reduce((s, k) => s + k.searchVolume, 0);

  // Keywords that improved
  const improvedKeywords = keywordsData.filter((k) => k.change != null && k.change > 0);
  const declinedKeywords = keywordsData.filter((k) => k.change != null && k.change < 0);

  // ── Build content data ──
  const currentPlan = client.contentPlans[0];
  const contentData = (currentPlan?.pieces || []).map((p) => ({
    title: p.title,
    type: p.type,
    status: p.status,
    keyword: p.keyword,
  }));

  const publishedPieces = contentData.filter((p) => p.status === "PUBLISHED").length;
  const totalPieces = contentData.length;
  const approvedPieces = contentData.filter((p) => p.status === "APPROVED").length;

  // ── Build deliverables data ──
  const currentDeliverables = client.deliverables.filter(
    (d) => d.month === month && d.year === year
  );
  const deliverablesData = currentDeliverables.map((d) => ({
    name: d.name,
    targetCount: d.targetCount,
    currentCount: d.currentCount,
    status: d.status,
  }));

  const completedDeliverables = currentDeliverables.filter((d) => d.status === "COMPLETED").length;
  const totalDeliverables = currentDeliverables.length;

  // ── Build highlights ──
  const highlights: string[] = [];

  if (page1Keywords.length > 0) {
    highlights.push(`${page1Keywords.length} keyword${page1Keywords.length > 1 ? "s" : ""} ranking on Google page 1`);
  }
  if (improvedKeywords.length > 0) {
    const totalGain = improvedKeywords.reduce((s, k) => s + k.change!, 0);
    highlights.push(`${improvedKeywords.length} keyword${improvedKeywords.length > 1 ? "s" : ""} improved positions (+${totalGain} total)`);
  }
  if (avgPosition != null) {
    highlights.push(`Average keyword position: ${avgPosition}`);
  }
  if (publishedPieces > 0) {
    highlights.push(`${publishedPieces} of ${totalPieces} content pieces published`);
  }
  if (completedDeliverables > 0) {
    highlights.push(`${completedDeliverables} of ${totalDeliverables} deliverables completed`);
  }

  // If no highlights, add a general one
  if (highlights.length === 0) {
    highlights.push(`Tracking ${totalKeywords} keywords for ${client.name}`);
  }

  // ── Build summary text ──
  const summary = `${monthNames[month - 1]} ${year} SEO Performance Report for ${client.name}. ` +
    (totalKeywords > 0
      ? `Currently tracking ${totalKeywords} keywords with ${page1Keywords.length} ranking on page 1. `
      : `Keyword tracking has been set up and results will appear in next month's report. `) +
    (publishedPieces > 0
      ? `${publishedPieces} content pieces were published this period. `
      : "") +
    (completedDeliverables > 0
      ? `${completedDeliverables} of ${totalDeliverables} deliverables were completed.`
      : "");

  // ── Build full snapshot ──
  const dataSnapshot = JSON.stringify({
    clientName: client.name,
    domain: client.domain || null,
    month,
    year,
    monthName: monthNames[month - 1],
    stats: {
      totalKeywords,
      page1Keywords: page1Keywords.length,
      page2Keywords: page2Keywords.length,
      avgPosition,
      totalSearchVolume,
      improvedCount: improvedKeywords.length,
      declinedCount: declinedKeywords.length,
      publishedContent: publishedPieces,
      totalContent: totalPieces,
      approvedContent: approvedPieces,
      completedDeliverables,
      totalDeliverables,
    },
    keywords: keywordsData
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      .slice(0, 20), // Top 20 keywords
    content: contentData,
    deliverables: deliverablesData,
    highlights,
    summary,
  });

  const report = await prisma.report.create({
    data: {
      clientId,
      month,
      year,
      title: `${monthNames[month - 1]} ${year} SEO Report`,
      summary: dataSnapshot,
      highlights: JSON.stringify(highlights),
      isPublished: true,
    },
  });

  return NextResponse.json(report);
}

/** PATCH: Archive/unarchive or update a report */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { reportId, isArchived } = body;
  if (!reportId || typeof isArchived !== "boolean") {
    return NextResponse.json(
      { error: "reportId and isArchived (boolean) are required" },
      { status: 400 }
    );
  }

  // Ensure report belongs to this client
  const report = await prisma.report.findFirst({
    where: { id: reportId, clientId },
  });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: { isArchived },
  });

  return NextResponse.json(updated);
}

/** DELETE: Permanently delete a report */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const url = new URL(request.url);
  const reportId = url.searchParams.get("reportId");

  if (!reportId) {
    return NextResponse.json({ error: "reportId is required" }, { status: 400 });
  }

  // Ensure report belongs to this client
  const report = await prisma.report.findFirst({
    where: { id: reportId, clientId },
  });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  await prisma.report.delete({ where: { id: reportId } });

  return NextResponse.json({ success: true });
}
