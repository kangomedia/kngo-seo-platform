import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, auditCompleteEmail } from "@/lib/email";

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
  try {
    const session = await auth();
    if (!session || session.user.role !== "AGENCY_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clientId } = await params;

    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error("[AUDIT CHECK] Failed to parse request body:", parseErr);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { auditId } = body;
    console.log(`[AUDIT CHECK] Starting check for auditId=${auditId}, clientId=${clientId}`);

    const audit = await prisma.siteAudit.findFirst({
      where: { id: auditId, clientId },
    });

    if (!audit?.taskId) {
      console.error(`[AUDIT CHECK] Audit not found or no taskId. auditId=${auditId}`);
      return NextResponse.json({ error: "Audit not found or no task ID" }, { status: 404 });
    }

    console.log(`[AUDIT CHECK] Found audit record. taskId=${audit.taskId}, status=${audit.status}`);

    const { login, password } = await getCredentials();
    const headers = {
      "Content-Type": "application/json",
      Authorization: authHeader(login, password),
    };

    // 1) Check crawl progress via summary (GET endpoint)
    console.log(`[AUDIT CHECK] Fetching summary for taskId=${audit.taskId}`);
    const summaryRes = await fetch(`${DATAFORSEO_API}/on_page/summary/${audit.taskId}`, {
      method: "GET",
      headers: {
        Authorization: authHeader(login, password),
      },
    });

    if (!summaryRes.ok) {
      const errorText = await summaryRes.text();
      console.error(`[AUDIT CHECK] Summary API failed. Status=${summaryRes.status}, Body=${errorText}`);
      return NextResponse.json({ error: "Failed to fetch summary", details: errorText }, { status: 500 });
    }

    const summaryData = await summaryRes.json();
    const result = summaryData?.tasks?.[0]?.result?.[0];

    console.log(`[AUDIT CHECK] Summary response status_code=${summaryData?.tasks?.[0]?.status_code}, result exists=${!!result}`);

    if (!result) {
      console.log(`[AUDIT CHECK] No result yet — crawl not ready. Raw tasks:`, JSON.stringify(summaryData?.tasks?.[0]?.status_code));
      return NextResponse.json({ status: "CRAWLING", message: "Results not ready yet" });
    }

    const crawlProgress = result.crawl_progress || "unknown";
    const crawlStatus = result.crawl_status || "unknown";
    console.log(`[AUDIT CHECK] taskId=${audit.taskId}, crawl_progress=${crawlProgress}, crawl_status=${crawlStatus}, pages_crawled=${result.pages_crawled}, pages_count=${result.pages_count}`);

    if (crawlProgress !== "finished") {
      const pagesCrawled = result.pages_crawled || 0;
      const pagesCount = result.pages_count || 0;
      await prisma.siteAudit.update({
        where: { id: auditId },
        data: { status: "CRAWLING", pagesCount: pagesCrawled },
      });
      return NextResponse.json({
        status: "CRAWLING",
        crawlProgress,
        crawlStatus,
        pagesCrawled,
        pagesCount,
        message: `Crawl is ${crawlProgress} — ${pagesCrawled} pages found`,
      });
    }

    // 2) Crawl finished — fetch page-level data
    console.log(`[AUDIT CHECK] Crawl finished! Fetching pages with HTML filter...`);
    let pagesRes = await fetch(`${DATAFORSEO_API}/on_page/pages`, {
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
      const errorText = await pagesRes.text();
      console.error(`[AUDIT CHECK] Pages API (HTML filter) failed. Status=${pagesRes.status}, Body=${errorText}`);
      return NextResponse.json({ error: "Failed to fetch pages", details: errorText }, { status: 500 });
    }

    let pagesData = await pagesRes.json();
    let pages = pagesData?.tasks?.[0]?.result?.[0]?.items || [];
    const totalCount = pagesData?.tasks?.[0]?.result?.[0]?.total_count || 0;

    console.log(`[AUDIT CHECK] HTML filter: ${pages.length} items returned, total_count=${totalCount}`);

    // Fallback: if HTML filter returned 0 pages but the crawl found pages, try without filter
    if (pages.length === 0 && (result.pages_crawled > 0 || result.pages_count > 0)) {
      console.log(`[AUDIT CHECK] HTML filter returned 0 pages but crawl found ${result.pages_crawled}. Trying without filter...`);
      pagesRes = await fetch(`${DATAFORSEO_API}/on_page/pages`, {
        method: "POST",
        headers,
        body: JSON.stringify([
          {
            id: audit.taskId,
            limit: 100,
            order_by: ["meta.external_links_count,desc"],
          },
        ]),
      });
      if (pagesRes.ok) {
        pagesData = await pagesRes.json();
        pages = pagesData?.tasks?.[0]?.result?.[0]?.items || [];
        const fallbackTotal = pagesData?.tasks?.[0]?.result?.[0]?.total_count || 0;
        console.log(`[AUDIT CHECK] Fallback (no filter): ${pages.length} items returned, total_count=${fallbackTotal}`);
        if (pages.length > 0) {
          console.log(`[AUDIT CHECK] Sample page: resource_type=${pages[0].resource_type}, status_code=${pages[0].status_code}, url=${pages[0].url}`);
        }
      } else {
        const errorText = await pagesRes.text();
        console.error(`[AUDIT CHECK] Fallback pages API failed. Status=${pagesRes.status}, Body=${errorText}`);
      }
    }

    if (pages.length === 0) {
      console.error(`[AUDIT CHECK] CRITICAL: 0 pages returned after all attempts.`, {
        crawl_status: result.crawl_status,
        crawl_progress: result.crawl_progress,
        pages_crawled: result.pages_crawled,
        pages_count: result.pages_count,
        onpage_score: result.onpage_score,
        domain_info: result.domain_info || "none",
      });
    }

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

    // 4) Compute health score — use summary-level score or average of per-page scores
    let onpageScore = result.onpage_score || null;
    
    if (onpageScore === null && pageRecords.length > 0) {
      const validScores = pageRecords
        .map((p: { onpageScore: number | null }) => p.onpageScore)
        .filter((s: number | null): s is number => s !== null);
      if (validScores.length > 0) {
        onpageScore = Math.round(validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length * 10) / 10;
      }
    }

    console.log(`[AUDIT CHECK] Saving ${pageRecords.length} page records to DB. Score=${onpageScore}`);

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
            onpage_score: onpageScore,
            checks: result.page_metrics?.checks || {},
          }),
        },
      }),
    ]);

    console.log(`[AUDIT COMPLETE] auditId=${auditId}, pages=${pages.length}, score=${onpageScore}`);

    // 5) Send email notification
    try {
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      const user = await prisma.user.findFirst({ where: { role: "AGENCY_ADMIN" } });
      if (user?.email && client) {
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const { subject, html } = auditCompleteEmail(
          client.name,
          client.domain,
          pages.length,
          onpageScore,
          clientId,
          auditId,
          baseUrl,
        );
        await sendEmail({ to: user.email, subject, html });
      }
    } catch (emailErr) {
      console.error("[AUDIT CHECK] Email notification failed:", emailErr);
    }

    return NextResponse.json({
      status: "COMPLETED",
      pagesCount: pages.length,
      onpageScore,
    });
  } catch (err) {
    console.error("[AUDIT CHECK] UNHANDLED ERROR:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
