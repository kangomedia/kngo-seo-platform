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

// POST — Poll DataForSEO for crawl results and store them
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const { auditId } = await request.json();

  const audit = await prisma.siteAudit.findFirst({
    where: { id: auditId, clientId },
  });

  if (!audit?.taskId) {
    return NextResponse.json({ error: "Audit not found or no task ID" }, { status: 404 });
  }

  const { login, password } = await getCredentials();
  const headers = {
    "Content-Type": "application/json",
    Authorization: authHeader(login, password),
  };

  // 1) Check crawl progress via summary
  const summaryRes = await fetch(`${DATAFORSEO_API}/on_page/summary/${audit.taskId}`, {
    method: "POST",
    headers,
    body: JSON.stringify([{ id: audit.taskId }]),
  });

  if (!summaryRes.ok) {
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }

  const summaryData = await summaryRes.json();
  const result = summaryData?.tasks?.[0]?.result?.[0];

  if (!result) {
    return NextResponse.json({ status: "CRAWLING", message: "Results not ready yet" });
  }

  const crawlProgress = result.crawl_progress || "unknown";
  console.log(`[AUDIT CHECK] taskId=${audit.taskId}, progress=${crawlProgress}`);

  if (crawlProgress !== "finished") {
    await prisma.siteAudit.update({
      where: { id: auditId },
      data: { status: "CRAWLING" },
    });
    return NextResponse.json({
      status: "CRAWLING",
      crawlProgress,
      message: `Crawl is ${crawlProgress}`,
    });
  }

  // 2) Crawl finished — fetch page-level data
  const pagesRes = await fetch(`${DATAFORSEO_API}/on_page/pages`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      {
        id: audit.taskId,
        limit: 100,
        order_by: ["meta.external_links_count,desc"],
        filters: ["resource_type", "=", "html"],
      },
    ]),
  });

  if (!pagesRes.ok) {
    return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 });
  }

  const pagesData = await pagesRes.json();
  const pages = pagesData?.tasks?.[0]?.result?.[0]?.items || [];

  // 3) Build check results for each page
  const pageRecords = pages.map((page: Record<string, unknown>) => {
    const meta = page.meta as Record<string, unknown> || {};
    const checks = page.checks as Record<string, unknown> || {};
    const onpage = page.onpage_score as number || null;

    return {
      auditId,
      url: (page.url as string) || "",
      statusCode: (page.status_code as number) || null,
      title: (meta.title as string) || null,
      description: (meta.description as string) || null,
      h1Count: (meta.htags as Record<string, string[]>)?.h1?.length || 0,
      wordCount: (meta.content as Record<string, unknown>)?.plain_text_word_count as number || 0,
      imageCount: (meta.images_count as number) || 0,
      imagesNoAlt: (meta.images_without_alt_count as number) || 0,
      checks: JSON.stringify(checks),
      onpageScore: onpage,
    };
  });

  // 4) Store results
  const onpageScore = result.onpage_score || null;

  await prisma.$transaction([
    prisma.siteAuditPage.deleteMany({ where: { auditId } }),
    ...pageRecords.map((p: { auditId: string; url: string; statusCode: number | null; title: string | null; description: string | null; h1Count: number; wordCount: number; imageCount: number; imagesNoAlt: number; checks: string; onpageScore: number | null }) =>
      prisma.siteAuditPage.create({ data: p })
    ),
    prisma.siteAudit.update({
      where: { id: auditId },
      data: {
        status: "COMPLETED",
        pagesCount: pages.length,
        onpageScore,
        summary: JSON.stringify({
          crawl_progress: result.crawl_progress,
          crawl_status: result.crawl_status,
          pages_count: result.pages_count,
          pages_crawled: result.pages_crawled,
          onpage_score: result.onpage_score,
          checks: result.page_metrics?.checks || {},
        }),
      },
    }),
  ]);

  console.log(`[AUDIT COMPLETE] auditId=${auditId}, pages=${pages.length}, score=${onpageScore}`);

  return NextResponse.json({
    status: "COMPLETED",
    pagesCount: pages.length,
    onpageScore,
  });
}
