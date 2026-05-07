import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getReportFailedChecks, getCheckLabel, getCheckDescription } from "@/lib/audit-checks";
import { fetchGSCData, fetchGA4Data } from "@/lib/google-data";
import { snapshotMonth } from "@/lib/performance";
import { generateNarrative } from "@/lib/claude";

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

  const { type, month: reqMonth, year: reqYear, quarter: reqQuarter } = body;
  if (!type || !["SITE_AUDIT", "BASELINE", "QUARTERLY"].includes(type)) {
    return NextResponse.json(
      { error: "type must be SITE_AUDIT, BASELINE, or QUARTERLY" },
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

    if (type === "QUARTERLY") {
      // quarter is 1..4; if not provided, derive from current month
      const q = reqQuarter || Math.ceil((reqMonth || now.getMonth() + 1) / 3);
      const snapshot = await buildQuarterlySnapshot(clientId, client.name, q, year);
      const report = await prisma.report.create({
        data: {
          clientId,
          type: "QUARTERLY",
          month: q * 3, // store last month of the quarter
          year,
          title: `Q${q} ${year} SEO Story — ${client.name}`,
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
  excludedFromReport?: boolean;
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

  // Process pages — filter out excluded pages first
  const includedPages = audit.pages.filter((p: PageRecord) => !p.excludedFromReport);
  const pages = includedPages.map((p: PageRecord) => {
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
    highlights.push(`${keywords.length} high-intent keywords discovered for your business`);
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

// ─── Quarterly Snapshot ───────────────────────────────────

async function buildQuarterlySnapshot(
  clientId: string,
  clientName: string,
  quarter: number,
  year: number
) {
  // Months in the quarter (1-12)
  const months = [quarter * 3 - 2, quarter * 3 - 1, quarter * 3];
  const quarterLabel = `Q${quarter} ${year}`;

  // Refresh each MonthlySnapshot first so we have current data.
  // snapshotMonth is idempotent and safely handles missing GA/GSC.
  for (const m of months) {
    try {
      await snapshotMonth(clientId, m, year);
    } catch (err) {
      console.warn(`[QUARTERLY] snapshot failed for ${year}-${m}`, err);
    }
  }

  const snapshots = await prisma.monthlySnapshot.findMany({
    where: {
      clientId,
      year,
      month: { in: months },
    },
    orderBy: { month: "asc" },
  });

  // Prior quarter for comparison
  const priorQuarter = quarter === 1 ? 4 : quarter - 1;
  const priorYear = quarter === 1 ? year - 1 : year;
  const priorMonths = [priorQuarter * 3 - 2, priorQuarter * 3 - 1, priorQuarter * 3];
  const priorSnapshots = await prisma.monthlySnapshot.findMany({
    where: {
      clientId,
      year: priorYear,
      month: { in: priorMonths },
    },
  });

  // Aggregate this quarter
  const totals = {
    clicks: 0,
    impressions: 0,
    nonBrandedClicks: 0,
    brandedClicks: 0,
    estTrafficValue: 0,
    phoneClicks: 0,
    formSubmits: 0,
    organicSessions: 0,
  };
  for (const s of snapshots) {
    totals.clicks += s.gscClicks;
    totals.impressions += s.gscImpressions;
    totals.nonBrandedClicks += s.gscNonBrandedClicks;
    totals.brandedClicks += s.gscBrandedClicks;
    totals.estTrafficValue += s.estTrafficValue;
    totals.phoneClicks += s.phoneClicks;
    totals.formSubmits += s.formSubmits;
    totals.organicSessions += s.ga4OrganicSessions;
  }
  const priorTotals = {
    clicks: 0,
    estTrafficValue: 0,
    phoneClicks: 0,
    formSubmits: 0,
  };
  for (const s of priorSnapshots) {
    priorTotals.clicks += s.gscClicks;
    priorTotals.estTrafficValue += s.estTrafficValue;
    priorTotals.phoneClicks += s.phoneClicks;
    priorTotals.formSubmits += s.formSubmits;
  }

  // Per-month series (for chart)
  const series = months.map((m) => {
    const s = snapshots.find((x) => x.month === m);
    return {
      month: m,
      clicks: s?.gscClicks || 0,
      nonBrandedClicks: s?.gscNonBrandedClicks || 0,
      estTrafficValue: s?.estTrafficValue || 0,
      phoneClicks: s?.phoneClicks || 0,
      formSubmits: s?.formSubmits || 0,
    };
  });

  // Top performers across the quarter (by total clicks across the 3 months)
  type AggPiece = {
    url: string;
    title?: string;
    clicks: number;
    impressions: number;
  };
  const byUrl = new Map<string, AggPiece>();
  for (const s of snapshots) {
    if (!s.pageData) continue;
    try {
      const pages = JSON.parse(s.pageData) as {
        url: string;
        clicks: number;
        impressions: number;
      }[];
      for (const p of pages) {
        const cur = byUrl.get(p.url) || { url: p.url, clicks: 0, impressions: 0 };
        cur.clicks += p.clicks;
        cur.impressions += p.impressions;
        byUrl.set(p.url, cur);
      }
    } catch {
      /* ignore */
    }
  }
  // Enrich with content-piece titles where we have them
  const pieces = await prisma.contentPiece.findMany({
    where: { contentPlan: { clientId }, publishedUrl: { not: null } },
    select: { title: true, publishedUrl: true },
  });
  const titleByUrl = new Map<string, string>();
  for (const p of pieces) if (p.publishedUrl) titleByUrl.set(p.publishedUrl, p.title);

  const topContent = Array.from(byUrl.values())
    .map((p) => ({ ...p, title: titleByUrl.get(p.url) || p.url }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);

  // Highlights
  const highlights: string[] = [];
  if (totals.estTrafficValue > 0) {
    highlights.push(
      `Estimated traffic value this quarter: $${Math.round(totals.estTrafficValue).toLocaleString()}`
    );
  }
  if (totals.nonBrandedClicks > 0) {
    highlights.push(`${totals.nonBrandedClicks.toLocaleString()} non-branded clicks (new search demand)`);
  }
  if (totals.phoneClicks > 0) {
    highlights.push(`${totals.phoneClicks} phone-number clicks`);
  }
  if (totals.formSubmits > 0) {
    highlights.push(`${totals.formSubmits} contact form submissions`);
  }
  if (priorTotals.clicks > 0) {
    const delta = totals.clicks - priorTotals.clicks;
    const pct = Math.round((delta / priorTotals.clicks) * 100);
    if (delta !== 0) {
      highlights.push(
        `${delta > 0 ? "+" : ""}${pct}% organic clicks vs Q${priorQuarter}`
      );
    }
  }

  // AI narrative (best-effort — never fails the build)
  let narrative = "";
  try {
    const dataBlob = JSON.stringify({
      quarter: quarterLabel,
      clientName,
      currentQuarter: totals,
      priorQuarter: priorTotals,
      topContent,
      monthlySeries: series,
    });
    narrative = await generateNarrative({
      systemPrompt:
        "You are an SEO account manager writing a quarterly recap for a non-technical small-business owner. " +
        "Tone: warm, plainspoken, confident — like explaining results to a friend over coffee. " +
        "Avoid jargon, hype, or generic phrases. " +
        "Structure: 1) one short paragraph naming the most important quarterly result, " +
        "2) one paragraph on what's working (cite specific content/keywords from the data), " +
        "3) one paragraph on what we're focused on next quarter. " +
        "Do not invent numbers. Do not use bullet points or markdown — flow as paragraphs. Cap at 220 words.",
      userMessage: `Write the quarterly recap from this data:\n\n${dataBlob}`,
    });
  } catch (err) {
    console.warn("[QUARTERLY] AI narrative failed:", err);
    narrative =
      `${quarterLabel} brought ${totals.clicks.toLocaleString()} organic clicks ` +
      `and an estimated $${Math.round(totals.estTrafficValue).toLocaleString()} of search traffic value. ` +
      `${totals.phoneClicks} phone clicks and ${totals.formSubmits} form submissions came in over the period.`;
  }

  return {
    clientName,
    reportType: "QUARTERLY",
    quarter,
    year,
    quarterLabel,
    generatedAt: new Date().toISOString(),
    totals,
    priorTotals,
    series,
    topContent,
    narrative,
    highlights,
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

