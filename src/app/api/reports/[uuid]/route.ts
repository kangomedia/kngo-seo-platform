import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET: Public endpoint — fetch report data by UUID (no auth required) */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;

  const report = await prisma.report.findUnique({
    where: { uuid },
    include: {
      client: {
        select: { name: true, domain: true },
      },
    },
  });

  if (!report || !report.isPublished) {
    return NextResponse.json(
      { error: "Report not found" },
      { status: 404 }
    );
  }

  // Parse the data snapshot
  let snapshot = null;
  try {
    snapshot = report.summary ? JSON.parse(report.summary) : null;
  } catch {
    // Legacy reports may have plain text summaries
    snapshot = {
      clientName: report.client.name,
      domain: report.client.domain,
      month: report.month,
      year: report.year,
      summary: report.summary,
      highlights: report.highlights ? JSON.parse(report.highlights) : [],
      keywords: [],
      content: [],
      deliverables: [],
      stats: {},
    };
  }

  return NextResponse.json({
    id: report.id,
    uuid: report.uuid,
    month: report.month,
    year: report.year,
    title: report.title,
    createdAt: report.createdAt,
    data: snapshot,
  });
}
