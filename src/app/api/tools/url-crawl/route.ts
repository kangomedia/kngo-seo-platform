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
 * GET /api/tools/url-crawl — List all URL crawls
 */
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const crawls = await prisma.urlCrawl.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      domain: true,
      label: true,
      status: true,
      pagesCount: true,
      maxPages: true,
      createdAt: true,
      client: { select: { name: true } },
    },
  });

  return NextResponse.json(crawls);
}

/**
 * POST /api/tools/url-crawl — Start a new URL crawl
 * Body: { domain: string, maxPages?: number, label?: string, clientId?: string }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { domain, maxPages = 500, label, clientId } = body;

  if (!domain || typeof domain !== "string") {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const { login, password } = await getCredentials();

  // Normalize domain
  let targetDomain = domain.trim();
  if (!targetDomain.startsWith("http://") && !targetDomain.startsWith("https://")) {
    targetDomain = `https://${targetDomain}`;
  }

  // Clamp maxPages
  const clampedMaxPages = Math.min(Math.max(Number(maxPages) || 500, 50), 2000);

  // Submit crawl task to DataForSEO
  const taskBody = [
    {
      target: targetDomain,
      max_crawl_pages: clampedMaxPages,
      enable_javascript: true,
      load_resources: true,
      enable_browser_rendering: true,
      support_cookies: true,
      respect_sitemap: true,
      store_raw_html: false,
    },
  ];

  const response = await fetch(`${DATAFORSEO_API}/on_page/task_post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(login, password),
    },
    body: JSON.stringify(taskBody),
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

  // Save crawl record
  const crawl = await prisma.urlCrawl.create({
    data: {
      domain: targetDomain,
      taskId,
      status: "CRAWLING",
      maxPages: clampedMaxPages,
      label: label || null,
      clientId: clientId || null,
    },
  });

  console.log(`[URL-CRAWL] Started crawl for ${targetDomain}, taskId: ${taskId}, crawlId: ${crawl.id}`);

  return NextResponse.json({ id: crawl.id, taskId, status: "CRAWLING" });
}
