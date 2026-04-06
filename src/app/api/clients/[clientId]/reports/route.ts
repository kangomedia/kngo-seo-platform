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

  const reports = await prisma.report.findMany({
    where: { clientId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
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

  // Get client info
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      keywords: {
        where: { isTracking: true },
        include: {
          snapshots: { orderBy: { checkedAt: "desc" }, take: 1 },
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

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Compute summary data
  const totalKeywords = client.keywords.length;
  const page1Keywords = client.keywords.filter(
    (kw) => kw.snapshots[0]?.position != null && kw.snapshots[0].position <= 10
  ).length;

  const positions = client.keywords
    .map((kw) => kw.snapshots[0]?.position)
    .filter((p): p is number => p != null);
  const avgPosition = positions.length > 0
    ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
    : "N/A";

  const currentPlan = client.contentPlans[0];
  const publishedPieces = currentPlan?.pieces.filter((p) => p.status === "PUBLISHED").length || 0;
  const totalPieces = currentPlan?.pieces.length || 0;

  const totalDeliverables = client.deliverables.length;
  const completedDeliverables = client.deliverables.filter((d) => d.status === "COMPLETED").length;

  // Build highlights
  const highlights = [];
  if (page1Keywords > 0) highlights.push(`${page1Keywords} keywords on page 1`);
  if (avgPosition !== "N/A") highlights.push(`Average position: ${avgPosition}`);
  if (publishedPieces > 0) highlights.push(`${publishedPieces} of ${totalPieces} content pieces published`);
  if (completedDeliverables > 0) highlights.push(`${completedDeliverables} of ${totalDeliverables} deliverables completed`);

  const summary = `${monthNames[month - 1]} ${year} SEO Performance Report for ${client.name}. ` +
    `Tracking ${totalKeywords} keywords with ${page1Keywords} ranking on page 1. ` +
    `${publishedPieces} content pieces published this period. ` +
    `${completedDeliverables} of ${totalDeliverables} deliverables completed.`;

  const report = await prisma.report.create({
    data: {
      clientId,
      month,
      year,
      title: `${monthNames[month - 1]} ${year} SEO Report`,
      summary,
      highlights: JSON.stringify(highlights),
      isPublished: true,
    },
  });

  return NextResponse.json(report);
}
