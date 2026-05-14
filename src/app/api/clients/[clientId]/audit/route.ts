import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

async function getCredentials() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables must be set.");
  }
  return { login, password };
}

function authHeader(login: string, password: string) {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

// GET — List past audits for a client
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const { searchParams } = new URL(request.url);
  const showArchived = searchParams.get("archived") === "true";

  const audits = await prisma.siteAudit.findMany({
    where: {
      clientId,
      archivedAt: showArchived ? { not: null } : null,
    },
    orderBy: { crawledAt: "desc" },
    take: 20,
    include: { _count: { select: { pages: true } } },
  });

  return NextResponse.json(audits);
}

// POST — Start a new site audit crawl
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client?.domain) {
    return NextResponse.json({ error: "Client has no domain set" }, { status: 400 });
  }

  const { login, password } = await getCredentials();

  let targetDomain = client.domain;
  if (!targetDomain.startsWith("http://") && !targetDomain.startsWith("https://")) {
    targetDomain = `https://${targetDomain}`;
  }

  // Sitemap precedence: explicit client config > WordPress index > generic root.
  // WordPress with Yoast/RankMath uses /sitemap_index.xml — defaulting to
  // /sitemap.xml on WP often returns the posts-only sitemap, capping the
  // crawl at home + blog posts.
  const sitemapUrl = client.sitemapUrl || `${targetDomain}/sitemap_index.xml`;

  // Submit crawl task to DataForSEO On-Page API
  const body = [
    {
      target: targetDomain,
      max_crawl_pages: 100,

      // Rendering — full browser rendering for accurate results
      enable_javascript: true,
      load_resources: true,
      enable_browser_rendering: true,
      support_cookies: true,

      // Sitemap — crawl pages in sitemap order, then discover others
      respect_sitemap: true,
      custom_sitemap: sitemapUrl,

      // Analysis — enable structured data validation and spell-check
      validate_micromarkup: true,
      check_spell: true,
      check_spell_language: "en",

      // Storage
      store_raw_html: false,

      // Custom thresholds — tuned to reduce false positives
      checks_threshold: {
        title_too_long: 60,        // Google's actual display cutoff (DFS default: 65)
        low_content_rate: 0.15,    // More lenient than DFS default of 0.1
      },
    },
  ];

  const response = await fetch(`${DATAFORSEO_API}/on_page/task_post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(login, password),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `DataForSEO error: ${error}` }, { status: 500 });
  }

  const result = await response.json();
  const taskId = result?.tasks?.[0]?.id;

  if (!taskId) {
    return NextResponse.json({ error: "Failed to create crawl task" }, { status: 500 });
  }

  // Save audit record
  const audit = await prisma.siteAudit.create({
    data: {
      clientId,
      taskId,
      status: "CRAWLING",
    },
  });

  console.log(`[AUDIT] Started crawl for ${client.domain}, taskId: ${taskId}, auditId: ${audit.id}`);

  return NextResponse.json({ auditId: audit.id, taskId, status: "CRAWLING" });
}
