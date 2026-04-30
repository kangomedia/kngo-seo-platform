import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

async function getCredentials() {
  let login = process.env.DATAFORSEO_LOGIN;
  let password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    const settings = await prisma.agencySettings.findUnique({ where: { id: "default" } });
    login = settings?.dataforseoLogin || undefined;
    password = settings?.dataforseoPwd || undefined;
  }
  if (!login || !password) throw new Error("DataForSEO credentials not configured");
  return { login, password };
}

function authHeader(login: string, password: string) {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

/**
 * GET /api/tools/url-crawl/[crawlId] — Get crawl details
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
    include: { client: { select: { name: true } } },
  });

  if (!crawl) {
    return NextResponse.json({ error: "Crawl not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...crawl,
    urls: crawl.urls ? JSON.parse(crawl.urls) : [],
  });
}

/**
 * POST /api/tools/url-crawl/[crawlId] — Poll for crawl completion
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ crawlId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { crawlId } = await params;

  const crawl = await prisma.urlCrawl.findUnique({ where: { id: crawlId } });
  if (!crawl?.taskId) {
    return NextResponse.json({ error: "Crawl not found or no task ID" }, { status: 404 });
  }

  if (crawl.status === "COMPLETED") {
    return NextResponse.json({ status: "COMPLETED", pagesCount: crawl.pagesCount });
  }

  const { login, password } = await getCredentials();
  const headers = {
    "Content-Type": "application/json",
    Authorization: authHeader(login, password),
  };

  // 1) Check crawl progress
  const summaryRes = await fetch(`${DATAFORSEO_API}/on_page/summary/${crawl.taskId}`, {
    method: "GET",
    headers: { Authorization: authHeader(login, password) },
  });

  if (!summaryRes.ok) {
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }

  const summaryData = await summaryRes.json();
  const result = summaryData?.tasks?.[0]?.result?.[0];

  if (!result) {
    return NextResponse.json({
      status: "CRAWLING",
      phase: "initializing",
      pagesCrawled: 0,
      message: "Crawl task is initializing...",
    });
  }

  const crawlProgress = result.crawl_progress || "unknown";

  if (crawlProgress !== "finished") {
    const pagesCrawled = result.pages_crawled || 0;
    const pagesInQueue = result.pages_in_queue || 0;
    await prisma.urlCrawl.update({
      where: { id: crawlId },
      data: { pagesCount: pagesCrawled },
    });
    return NextResponse.json({
      status: "CRAWLING",
      phase: "crawling",
      crawlProgress,
      pagesCrawled,
      pagesInQueue,
      pagesCount: result.pages_count || 0,
    });
  }

  // 2) Crawl finished — fetch ALL pages with pagination
  interface CrawledPage {
    url: string;
    status_code: number | null;
    resource_type: string | null;
    meta?: {
      title?: string;
      description?: string;
      content?: { plain_text_word_count?: number };
    };
  }

  const allPages: CrawledPage[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const pagesRes = await fetch(`${DATAFORSEO_API}/on_page/pages`, {
      method: "POST",
      headers,
      body: JSON.stringify([
        {
          id: crawl.taskId,
          limit,
          offset,
          filters: ["resource_type", "=", "html"],
        },
      ]),
    });

    if (!pagesRes.ok) break;

    const pagesData = await pagesRes.json();
    const items = pagesData?.tasks?.[0]?.result?.[0]?.items || [];

    if (items.length === 0) break;

    allPages.push(...items);
    offset += items.length;

    // Safety cap
    if (allPages.length >= crawl.maxPages || items.length < limit) break;
  }

  // If HTML filter returned nothing, try without filter
  if (allPages.length === 0 && (result.pages_crawled > 0)) {
    offset = 0;
    while (true) {
      const pagesRes = await fetch(`${DATAFORSEO_API}/on_page/pages`, {
        method: "POST",
        headers,
        body: JSON.stringify([
          {
            id: crawl.taskId,
            limit,
            offset,
          },
        ]),
      });

      if (!pagesRes.ok) break;

      const pagesData = await pagesRes.json();
      const items = pagesData?.tasks?.[0]?.result?.[0]?.items || [];

      if (items.length === 0) break;

      allPages.push(...items);
      offset += items.length;
      if (allPages.length >= crawl.maxPages || items.length < limit) break;
    }
  }

  // 3) Build clean URL list
  const urlList = allPages.map((page: CrawledPage) => ({
    url: page.url || "",
    statusCode: page.status_code || null,
    resourceType: page.resource_type || null,
    title: page.meta?.title || null,
    description: page.meta?.description || null,
    wordCount: page.meta?.content?.plain_text_word_count || 0,
  }));

  // 4) Save to DB
  await prisma.urlCrawl.update({
    where: { id: crawlId },
    data: {
      status: "COMPLETED",
      pagesCount: urlList.length,
      urls: JSON.stringify(urlList),
    },
  });

  console.log(`[URL-CRAWL] Completed: ${crawl.domain}, ${urlList.length} URLs found`);

  return NextResponse.json({
    status: "COMPLETED",
    pagesCount: urlList.length,
  });
}

/**
 * DELETE /api/tools/url-crawl/[crawlId] — Delete a crawl
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ crawlId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { crawlId } = await params;

  await prisma.urlCrawl.delete({ where: { id: crawlId } });

  return NextResponse.json({ success: true });
}
