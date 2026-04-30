import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/tools/url-crawl/[crawlId]/export — Export URLs as CSV
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ crawlId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { crawlId } = await params;

  const crawl = await prisma.urlCrawl.findUnique({
    where: { id: crawlId },
  });

  if (!crawl || !crawl.urls) {
    return NextResponse.json({ error: "Crawl not found or no URL data" }, { status: 404 });
  }

  interface UrlRow {
    url: string;
    statusCode: number | null;
    title: string | null;
    description: string | null;
    wordCount: number;
  }

  const urls: UrlRow[] = JSON.parse(crawl.urls);

  // Build CSV
  const csvHeader = "URL,Status Code,Title,Word Count";
  const csvRows = urls.map((u) => {
    const escapedTitle = (u.title || "").replace(/"/g, '""');
    return `"${u.url}",${u.statusCode || ""},\"${escapedTitle}\",${u.wordCount || 0}`;
  });

  const csv = [csvHeader, ...csvRows].join("\n");

  // Filename
  const domainClean = crawl.domain
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9.-]/g, "_");
  const filename = `url-crawl_${domainClean}_${crawl.createdAt.toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
