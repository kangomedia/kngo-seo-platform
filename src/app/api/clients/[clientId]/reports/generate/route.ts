import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getReportFailedChecks, getCheckLabel, getCheckDescription } from "@/lib/audit-checks";

/**
 * POST /api/clients/[clientId]/reports/generate
 * Generate a Site Audit Report or Baseline Report
 * Body: { type: "SITE_AUDIT" | "BASELINE" }
 */
export async function POST(
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
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { type, month: reqMonth, year: reqYear } = body;
  if (!type || !["SITE_AUDIT", "BASELINE"].includes(type)) {
    return NextResponse.json(
      { error: "type must be SITE_AUDIT or BASELINE" },
      { status: 400 }
    );
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      domain: true,
      gscProperty: true,
      ga4PropertyId: true,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const now = new Date();
  const month = reqMonth || now.getMonth() + 1;
  const year = reqYear || now.getFullYear();

  try {
    if (type === "SITE_AUDIT") {
      const snapshot = await buildSiteAuditSnapshot(clientId, client.name, client.domain);
      const report = await prisma.report.create({
        data: {
          clientId,
          type: "SITE_AUDIT",
          month,
          year,
          title: `Site Audit Report — ${client.name}`,
          summary: JSON.stringify(snapshot),
          highlights: JSON.stringify(snapshot.highlights),
          isPublished: true,
        },
      });
      return NextResponse.json(report);
    }

    if (type === "BASELINE") {
      const snapshot = await buildBaselineSnapshot(
        clientId,
        client.name,
        client.domain,
        client.gscProperty,
        client.ga4PropertyId,
      );
      const report = await prisma.report.create({
        data: {
          clientId,
          type: "BASELINE",
          month,
          year,
          title: `SEO Baseline Report — ${client.name}`,
          summary: JSON.stringify(snapshot),
          highlights: JSON.stringify(snapshot.highlights),
          isPublished: true,
        },
      });
      return NextResponse.json(report);
    }
  } catch (err) {
    console.error("[REPORT GENERATE] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate report", details: String(err) },
      { status: 500 }
    );
  }
}

// ─── Site Audit Snapshot ──────────────────────────────────

interface PageRecord {
  url: string;
  statusCode: number | null;
  title: string | null;
  wordCount: number;
  onpageScore: number | null;
  checks: string | null;
  recommendations: string | null;
}

async function buildSiteAuditSnapshot(
  clientId: string,
  clientName: string,
  domain: string | null
) {
  // Get the latest completed audit
  const audit = await prisma.siteAudit.findFirst({
    where: { clientId, status: "COMPLETED" },
    orderBy: { crawledAt: "desc" },
    include: {
      pages: {
        orderBy: { onpageScore: "asc" },
      },
    },
  });

  if (!audit) {
    return {
      clientName,
      domain,
      reportType: "SITE_AUDIT",
      generatedAt: new Date().toISOString(),
      hasAuditData: false,
      healthScore: null,
      pagesCount: 0,
      pages: [],
      issuesSummary: {},
      highlights: ["No completed site audit found. Run an audit first to generate this report."],
    };
  }

  // Process pages
  const pages = audit.pages.map((p: PageRecord) => {
    const checksObj = p.checks ? JSON.parse(p.checks) : {};
    const failedChecks = getReportFailedChecks(checksObj);
    const recs = p.recommendations ? JSON.parse(p.recommendations) : [];

    return {
      url: p.url,
      statusCode: p.statusCode,
      title: p.title,
      wordCount: p.wordCount,
      onpageScore: p.onpageScore,
      issueCount: failedChecks.length,
      issues: failedChecks.map((key: string) => ({
        key,
        label: getCheckLabel(key),
        description: getCheckDescription(key),
      })),
      topRecommendation: recs[0]?.recommendation || null,
    };
  });

  // Aggregate issues across all pages
  const issueCounts: Record<string, { label: string; count: number; severity: string }> = {};
  for (const page of pages) {
    for (const issue of page.issues) {
      if (!issueCounts[issue.key]) {
        issueCounts[issue.key] = {
          label: issue.label,
          count: 0,
          severity: getSeverity(issue.key),
        };
      }
      issueCounts[issue.key].count++;
    }
  }

  // Sort by count descending
  const issuesSorted = Object.entries(issueCounts)
    .sort(([, a], [, b]) => b.count - a.count);

  const criticalCount = issuesSorted.filter(([, v]) => v.severity === "critical").length;
  const warningCount = issuesSorted.filter(([, v]) => v.severity === "warning").length;
  const totalIssueTypes = issuesSorted.length;
  const pagesWithIssues = pages.filter((p) => p.issueCount > 0).length;

  // Build highlights
  const highlights: string[] = [];
  if (audit.onpageScore != null) {
    highlights.push(`Overall health score: ${Math.round(audit.onpageScore)}/100`);
  }
  highlights.push(`${audit.pagesCount} pages crawled and analyzed`);
  if (criticalCount > 0) {
    highlights.push(`${criticalCount} critical issue type${criticalCount > 1 ? "s" : ""} found`);
  }
  if (pagesWithIssues > 0) {
    highlights.push(`${pagesWithIssues} of ${pages.length} pages have issues to address`);
  }
  const perfectPages = pages.filter((p) => p.issueCount === 0).length;
  if (perfectPages > 0) {
    highlights.push(`${perfectPages} page${perfectPages > 1 ? "s" : ""} passed all checks`);
  }

  return {
    clientName,
    domain,
    reportType: "SITE_AUDIT",
    generatedAt: new Date().toISOString(),
    auditDate: audit.crawledAt.toISOString(),
    hasAuditData: true,
    healthScore: audit.onpageScore,
    pagesCount: audit.pagesCount,
    totalIssueTypes,
    criticalCount,
    warningCount,
    pagesWithIssues,
    perfectPages,
    issuesSummary: Object.fromEntries(issuesSorted),
    pages: pages.slice(0, 50), // Cap at 50 pages for the report
    topIssues: issuesSorted.slice(0, 10).map(([key, v]) => ({
      key,
      label: v.label,
      count: v.count,
      severity: v.severity,
      description: getCheckDescription(key),
    })),
    worstPages: [...pages]
      .filter((p) => p.onpageScore != null)
      .sort((a, b) => (a.onpageScore ?? 100) - (b.onpageScore ?? 100))
      .slice(0, 5),
    bestPages: [...pages]
      .filter((p) => p.onpageScore != null)
      .sort((a, b) => (b.onpageScore ?? 0) - (a.onpageScore ?? 0))
      .slice(0, 5),
    highlights,
  };
}

// ─── Baseline Snapshot ────────────────────────────────────

async function buildBaselineSnapshot(
  clientId: string,
  clientName: string,
  domain: string | null,
  gscProperty: string | null,
  ga4PropertyId: string | null,
) {
  // Start with the audit data
  const auditSnapshot = await buildSiteAuditSnapshot(clientId, clientName, domain);

  // Get keyword research data
  const research = await prisma.keywordResearch.findFirst({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });

  let keywords: Array<{
    keyword: string;
    searchVolume: number;
    competition: number;
    cpc: number;
    source: string;
  }> = [];
  let aiAnalysis: string | null = null;

  if (research) {
    try {
      const parsed = JSON.parse(research.results);
      keywords = parsed.slice(0, 30);
    } catch { /* */ }
    aiAnalysis = research.aiAnalysis || null;
  }

  // Try to fetch GSC data
  let gscData = null;
  if (gscProperty) {
    try {
      gscData = await fetchGSCData(clientId, gscProperty);
    } catch (err) {
      console.warn("[BASELINE] Could not fetch GSC data:", err);
    }
  }

  // Try to fetch GA4 data
  let ga4Data = null;
  if (ga4PropertyId) {
    try {
      ga4Data = await fetchGA4Data(clientId, ga4PropertyId);
    } catch (err) {
      console.warn("[BASELINE] Could not fetch GA4 data:", err);
    }
  }

  // Build highlights
  const highlights = [...auditSnapshot.highlights];
  if (keywords.length > 0) {
    const totalVolume = keywords.reduce((s, k) => s + k.searchVolume, 0);
    highlights.push(`${keywords.length} keywords discovered (${totalVolume.toLocaleString()} combined monthly searches)`);
  }
  if (gscData) {
    const totalClicks = gscData.topQueries?.reduce((s: number, q: { clicks: number }) => s + q.clicks, 0) || 0;
    const totalImpressions = gscData.topQueries?.reduce((s: number, q: { impressions: number }) => s + q.impressions, 0) || 0;
    if (totalClicks > 0) highlights.push(`${totalClicks.toLocaleString()} organic clicks in the last 30 days`);
    if (totalImpressions > 0) highlights.push(`${totalImpressions.toLocaleString()} search impressions in the last 30 days`);
  }
  if (ga4Data) {
    if (ga4Data.sessions > 0) highlights.push(`${ga4Data.sessions.toLocaleString()} website sessions in the last 30 days`);
  }

  return {
    ...auditSnapshot,
    reportType: "BASELINE",
    hasKeywords: keywords.length > 0,
    keywords,
    aiAnalysis,
    hasGSC: !!gscData,
    gsc: gscData,
    hasGA4: !!ga4Data,
    ga4: ga4Data,
    highlights,
  };
}

// ─── Google Data Fetchers ─────────────────────────────────

async function fetchGSCData(clientId: string, gscProperty: string) {
  const { google } = await import("googleapis");

  const token = await prisma.googleToken.findUnique({ where: { clientId } });
  if (!token) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  });

  const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const [queriesRes, pagesRes, dailyRes] = await Promise.all([
    searchconsole.searchanalytics.query({
      siteUrl: gscProperty,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["query"],
        rowLimit: 20,
      },
    }),
    searchconsole.searchanalytics.query({
      siteUrl: gscProperty,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["page"],
        rowLimit: 15,
      },
    }),
    searchconsole.searchanalytics.query({
      siteUrl: gscProperty,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["date"],
      },
    }),
  ]);

  return {
    dateRange: { start: fmt(startDate), end: fmt(endDate) },
    topQueries: (queriesRes.data.rows || []).map((r) => ({
      query: r.keys?.[0],
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position ? Math.round(r.position * 10) / 10 : null,
    })),
    topPages: (pagesRes.data.rows || []).map((r) => ({
      page: r.keys?.[0],
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
    })),
    daily: (dailyRes.data.rows || []).map((r) => ({
      date: r.keys?.[0],
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
    })),
  };
}

async function fetchGA4Data(clientId: string, ga4PropertyId: string) {
  const { google } = await import("googleapis");

  const token = await prisma.googleToken.findUnique({ where: { clientId } });
  if (!token) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  });

  const analyticsdata = google.analyticsdata({ version: "v1beta", auth: oauth2Client });

  const overviewRes = await analyticsdata.properties.runReport({
    property: `properties/${ga4PropertyId}`,
    requestBody: {
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "screenPageViews" },
      ],
    },
  });

  const sourceRes = await analyticsdata.properties.runReport({
    property: `properties/${ga4PropertyId}`,
    requestBody: {
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      limit: "10",
    },
  });

  interface GA4Row {
    dimensionValues?: { value?: string | null }[];
    metricValues?: { value?: string | null }[];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overview = (overviewRes as any).data?.rows?.[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceRows = ((sourceRes as any).data?.rows || []) as GA4Row[];

  return {
    sessions: parseInt(overview?.metricValues?.[0]?.value || "0"),
    users: parseInt(overview?.metricValues?.[1]?.value || "0"),
    bounceRate: parseFloat(overview?.metricValues?.[2]?.value || "0"),
    avgSessionDuration: parseFloat(overview?.metricValues?.[3]?.value || "0"),
    pageViews: parseInt(overview?.metricValues?.[4]?.value || "0"),
    trafficSources: sourceRows.map((r) => ({
      channel: r.dimensionValues?.[0]?.value || "Unknown",
      sessions: parseInt(r.metricValues?.[0]?.value || "0"),
      users: parseInt(r.metricValues?.[1]?.value || "0"),
    })),
  };
}

// ─── Helpers ──────────────────────────────────────────────

function getSeverity(checkKey: string): string {
  const critical = new Set([
    "no_title",
    "no_description",
    "is_broken",
    "is_4xx_code",
    "is_5xx_code",
    "no_h1_tag",
    "duplicate_title",
    "duplicate_description",
    "canonical_to_broken",
  ]);
  const warning = new Set([
    "title_too_long",
    "title_too_short",
    "low_content_rate",
    "low_readability_rate",
    "has_render_blocking_resources",
    "https_to_http_links",
    "redirect_chain",
    "has_links_to_redirects",
    "duplicate_meta_tags",
    "is_orphan_page",
    "no_image_alt",
    "large_page_size",
    "high_loading_time",
    "high_waiting_time",
  ]);
  if (critical.has(checkKey)) return "critical";
  if (warning.has(checkKey)) return "warning";
  return "info";
}
