// Performance / ROI calculations.
//
// Built on top of GSC + GA4 fetches. Provides:
//   - Branded vs non-branded query splitting
//   - Estimated traffic value (non-branded clicks × per-client CPC)
//   - Per-URL content performance (joins ContentPiece.publishedUrl to GSC pages)
//   - Engagement-event counts from GA4 (phone_click, form_submit, email_click)
//   - Monthly snapshot persistence

import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

// ─── Types ───────────────────────────────────────────────

export interface GSCQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  isBranded: boolean;
}

export interface GSCPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

export interface ContentPerformanceRow {
  pieceId: string;
  title: string;
  type: string;
  publishedUrl: string;
  publishedAt: Date | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  topQueries: { query: string; clicks: number }[];
}

export interface EngagementEvents {
  phoneClicks: number;
  formSubmits: number;
  emailClicks: number;
}

export interface PerformanceSummary {
  dateRange: { start: string; end: string };
  hasGSC: boolean;
  hasGA4: boolean;

  // Hero numbers
  totalClicks: number;
  totalImpressions: number;
  brandedClicks: number;
  nonBrandedClicks: number;
  estTrafficValueUsd: number;
  cpcUsedUsd: number;

  // Engagement
  events: EngagementEvents;

  // GA4 totals
  organicSessions: number;
  totalSessions: number;

  // Drill-down
  topQueries: GSCQueryRow[];
  contentPerformance: ContentPerformanceRow[];
  brandTermsUsed: string[];
}

// ─── Brand-term derivation ───────────────────────────────

/** Tokenize a client's name + domain into lowercase brand-term candidates. */
export function deriveBrandTerms(client: {
  name: string;
  domain: string | null;
  brandTerms: string | null;
}): string[] {
  // Explicit override wins.
  if (client.brandTerms) {
    try {
      const parsed = JSON.parse(client.brandTerms);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t: unknown) => String(t).toLowerCase().trim()).filter(Boolean);
      }
    } catch {
      // fall through to derived
    }
  }

  const terms = new Set<string>();
  // Name tokens — drop common business suffixes
  const stopwords = new Set([
    "llc", "inc", "co", "corp", "company", "the", "and", "of", "&",
    "ltd", "group", "services", "service",
  ]);
  for (const tok of client.name.toLowerCase().split(/[\s.,&]+/)) {
    const t = tok.trim();
    if (t.length >= 3 && !stopwords.has(t)) terms.add(t);
  }
  // Domain root (strip protocol, www, TLD)
  if (client.domain) {
    const host = client.domain
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
    const root = host.split(".")[0];
    if (root && root.length >= 3) terms.add(root);
  }
  return Array.from(terms);
}

/** A query is "branded" if any brand term appears as a substring. */
export function isBrandedQuery(query: string, brandTerms: string[]): boolean {
  const q = query.toLowerCase();
  return brandTerms.some((t) => q.includes(t));
}

// ─── URL normalization for ContentPiece ↔ GSC matching ───

/** Strip protocol + host + query + trailing slash; lowercase. */
export function normalizeUrlPath(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname || "/";
    if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);
    return path.toLowerCase();
  } catch {
    // not a full URL — treat as path
    let p = url.trim();
    if (!p.startsWith("/")) p = "/" + p;
    if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
    return p.toLowerCase();
  }
}

// ─── Google auth helper ──────────────────────────────────

async function getGoogleAuth(clientId: string) {
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

  oauth2Client.on("tokens", async (newTokens) => {
    if (newTokens.access_token) {
      await prisma.googleToken.update({
        where: { clientId },
        data: {
          accessToken: newTokens.access_token,
          expiresAt: new Date(newTokens.expiry_date || Date.now() + 3600000),
        },
      });
    }
  });

  return oauth2Client;
}

// ─── Date helpers ────────────────────────────────────────

const fmt = (d: Date) => d.toISOString().split("T")[0];

export function monthRange(month: number, year: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start: fmt(start), end: fmt(end) };
}

export function lastNDaysRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { start: fmt(start), end: fmt(end) };
}

// ─── GSC fetchers ────────────────────────────────────────

interface GSCRange {
  start: string;
  end: string;
}

async function fetchGSCQueries(
  authClient: NonNullable<Awaited<ReturnType<typeof getGoogleAuth>>>,
  siteUrl: string,
  range: GSCRange,
  rowLimit: number
) {
  const sc = google.searchconsole({ version: "v1", auth: authClient });
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: range.start,
      endDate: range.end,
      dimensions: ["query"],
      rowLimit,
    },
  });
  return (res.data.rows || []).map((r) => ({
    query: r.keys?.[0] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position != null ? Math.round(r.position * 10) / 10 : null,
  }));
}

async function fetchGSCPages(
  authClient: NonNullable<Awaited<ReturnType<typeof getGoogleAuth>>>,
  siteUrl: string,
  range: GSCRange,
  rowLimit: number
): Promise<GSCPageRow[]> {
  const sc = google.searchconsole({ version: "v1", auth: authClient });
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: range.start,
      endDate: range.end,
      dimensions: ["page"],
      rowLimit,
    },
  });
  return (res.data.rows || []).map((r) => ({
    page: r.keys?.[0] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position != null ? Math.round(r.position * 10) / 10 : null,
  }));
}

async function fetchGSCPageQueries(
  authClient: NonNullable<Awaited<ReturnType<typeof getGoogleAuth>>>,
  siteUrl: string,
  range: GSCRange,
  rowLimit: number
) {
  // Joint dimensions = page + query, so we can give each ContentPiece its top queries.
  const sc = google.searchconsole({ version: "v1", auth: authClient });
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: range.start,
      endDate: range.end,
      dimensions: ["page", "query"],
      rowLimit,
    },
  });
  return (res.data.rows || []).map((r) => ({
    page: r.keys?.[0] || "",
    query: r.keys?.[1] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
  }));
}

// ─── GA4 fetchers ────────────────────────────────────────

interface GA4Totals {
  sessions: number;
  users: number;
  organicSessions: number;
  pageViews: number;
  events: EngagementEvents;
}

async function fetchGA4Totals(
  authClient: NonNullable<Awaited<ReturnType<typeof getGoogleAuth>>>,
  ga4PropertyId: string,
  range: GSCRange
): Promise<GA4Totals> {
  const ad = google.analyticsdata({ version: "v1beta", auth: authClient });
  const property = `properties/${ga4PropertyId}`;
  const dateRanges = [{ startDate: range.start, endDate: range.end }];

  // Overview
  const overviewRes = await ad.properties.runReport({
    property,
    requestBody: {
      dateRanges,
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "screenPageViews" },
      ],
    },
  });

  // Organic-only sessions (filter on default channel group)
  const organicRes = await ad.properties.runReport({
    property,
    requestBody: {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
    },
  });

  // Event counts (phone_click, form_submit, email_click)
  const eventsRes = await ad.properties.runReport({
    property,
    requestBody: {
      dateRanges,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: {
            values: ["phone_click", "form_submit", "email_click"],
          },
        },
      },
    },
  });

  const overview = overviewRes.data.rows?.[0]?.metricValues || [];
  const sessions = parseInt(overview[0]?.value || "0", 10);
  const users = parseInt(overview[1]?.value || "0", 10);
  const pageViews = parseInt(overview[2]?.value || "0", 10);

  let organicSessions = 0;
  for (const row of organicRes.data.rows || []) {
    const channel = row.dimensionValues?.[0]?.value?.toLowerCase() || "";
    if (channel.includes("organic search")) {
      organicSessions += parseInt(row.metricValues?.[0]?.value || "0", 10);
    }
  }

  const events: EngagementEvents = { phoneClicks: 0, formSubmits: 0, emailClicks: 0 };
  for (const row of eventsRes.data.rows || []) {
    const name = row.dimensionValues?.[0]?.value || "";
    const count = parseInt(row.metricValues?.[0]?.value || "0", 10);
    if (name === "phone_click") events.phoneClicks = count;
    else if (name === "form_submit") events.formSubmits = count;
    else if (name === "email_click") events.emailClicks = count;
  }

  return { sessions, users, organicSessions, pageViews, events };
}

// ─── The main bundle ─────────────────────────────────────

export async function fetchPerformanceSummary(
  clientId: string,
  range: GSCRange
): Promise<PerformanceSummary> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      name: true,
      domain: true,
      brandTerms: true,
      avgCpcUsd: true,
      gscProperty: true,
      ga4PropertyId: true,
    },
  });
  if (!client) throw new Error("Client not found");

  const brandTerms = deriveBrandTerms({
    name: client.name,
    domain: client.domain,
    brandTerms: client.brandTerms,
  });

  const authClient = await getGoogleAuth(clientId);

  let topQueries: GSCQueryRow[] = [];
  let contentPerformance: ContentPerformanceRow[] = [];
  let totalClicks = 0;
  let totalImpressions = 0;
  let brandedClicks = 0;
  let nonBrandedClicks = 0;

  if (authClient && client.gscProperty) {
    const queries = await fetchGSCQueries(authClient, client.gscProperty, range, 100);
    topQueries = queries.map((q) => ({
      ...q,
      isBranded: isBrandedQuery(q.query, brandTerms),
    }));
    for (const q of topQueries) {
      totalClicks += q.clicks;
      totalImpressions += q.impressions;
      if (q.isBranded) brandedClicks += q.clicks;
      else nonBrandedClicks += q.clicks;
    }

    // Build content performance: pages → matched ContentPiece rows
    const [pageRows, pageQueryRows, contentPieces] = await Promise.all([
      fetchGSCPages(authClient, client.gscProperty, range, 500),
      fetchGSCPageQueries(authClient, client.gscProperty, range, 1000),
      prisma.contentPiece.findMany({
        where: {
          contentPlan: { clientId },
          publishedUrl: { not: null },
        },
        select: {
          id: true,
          title: true,
          type: true,
          publishedUrl: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: "desc" },
      }),
    ]);

    const pageByPath = new Map<string, GSCPageRow>();
    for (const p of pageRows) pageByPath.set(normalizeUrlPath(p.page), p);

    const queriesByPath = new Map<string, { query: string; clicks: number }[]>();
    for (const r of pageQueryRows) {
      const path = normalizeUrlPath(r.page);
      const arr = queriesByPath.get(path) || [];
      arr.push({ query: r.query, clicks: r.clicks });
      queriesByPath.set(path, arr);
    }

    contentPerformance = contentPieces
      .filter((p) => p.publishedUrl)
      .map((p) => {
        const path = normalizeUrlPath(p.publishedUrl!);
        const match = pageByPath.get(path);
        const queries = (queriesByPath.get(path) || [])
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 3);
        return {
          pieceId: p.id,
          title: p.title,
          type: p.type,
          publishedUrl: p.publishedUrl!,
          publishedAt: p.publishedAt,
          clicks: match?.clicks || 0,
          impressions: match?.impressions || 0,
          ctr: match?.ctr || 0,
          position: match?.position ?? null,
          topQueries: queries,
        };
      })
      // Show best performers first; pieces with 0 clicks still appear at the bottom
      .sort((a, b) => b.clicks - a.clicks);
  }

  let totalSessions = 0;
  let organicSessions = 0;
  const events: EngagementEvents = { phoneClicks: 0, formSubmits: 0, emailClicks: 0 };

  if (authClient && client.ga4PropertyId) {
    try {
      const totals = await fetchGA4Totals(authClient, client.ga4PropertyId, range);
      totalSessions = totals.sessions;
      organicSessions = totals.organicSessions;
      Object.assign(events, totals.events);
    } catch (err) {
      console.error("[performance] GA4 fetch failed", err);
    }
  }

  const cpcUsedUsd = client.avgCpcUsd;
  const estTrafficValueUsd = Math.round(nonBrandedClicks * cpcUsedUsd * 100) / 100;

  return {
    dateRange: range,
    hasGSC: !!(authClient && client.gscProperty),
    hasGA4: !!(authClient && client.ga4PropertyId),
    totalClicks,
    totalImpressions,
    brandedClicks,
    nonBrandedClicks,
    estTrafficValueUsd,
    cpcUsedUsd,
    events,
    organicSessions,
    totalSessions,
    topQueries: topQueries.slice(0, 25),
    contentPerformance,
    brandTermsUsed: brandTerms,
  };
}

// ─── Snapshot writer ─────────────────────────────────────

/**
 * Writes (or updates) a MonthlySnapshot row for the given client/month/year.
 * Idempotent — safe to call from cron + on-demand "Generate Report" flow.
 */
export async function snapshotMonth(
  clientId: string,
  month: number,
  year: number
) {
  const range = monthRange(month, year);
  const summary = await fetchPerformanceSummary(clientId, range);

  const pageData = JSON.stringify(
    summary.contentPerformance.map((c) => ({
      url: c.publishedUrl,
      clicks: c.clicks,
      impressions: c.impressions,
      ctr: c.ctr,
      position: c.position,
    }))
  );
  const queryData = JSON.stringify(
    summary.topQueries.map((q) => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position,
      isBranded: q.isBranded,
    }))
  );

  const avgPos =
    summary.topQueries.length > 0
      ? summary.topQueries.reduce((s, q) => s + (q.position || 0), 0) /
        summary.topQueries.filter((q) => q.position != null).length
      : null;

  return prisma.monthlySnapshot.upsert({
    where: {
      clientId_month_year: { clientId, month, year },
    },
    create: {
      clientId,
      month,
      year,
      gscClicks: summary.totalClicks,
      gscImpressions: summary.totalImpressions,
      gscBrandedClicks: summary.brandedClicks,
      gscNonBrandedClicks: summary.nonBrandedClicks,
      gscAvgPosition: avgPos,
      ga4Sessions: summary.totalSessions,
      ga4OrganicSessions: summary.organicSessions,
      phoneClicks: summary.events.phoneClicks,
      formSubmits: summary.events.formSubmits,
      emailClicks: summary.events.emailClicks,
      estTrafficValue: summary.estTrafficValueUsd,
      cpcUsedUsd: summary.cpcUsedUsd,
      pageData,
      queryData,
    },
    update: {
      gscClicks: summary.totalClicks,
      gscImpressions: summary.totalImpressions,
      gscBrandedClicks: summary.brandedClicks,
      gscNonBrandedClicks: summary.nonBrandedClicks,
      gscAvgPosition: avgPos,
      ga4Sessions: summary.totalSessions,
      ga4OrganicSessions: summary.organicSessions,
      phoneClicks: summary.events.phoneClicks,
      formSubmits: summary.events.formSubmits,
      emailClicks: summary.events.emailClicks,
      estTrafficValue: summary.estTrafficValueUsd,
      cpcUsedUsd: summary.cpcUsedUsd,
      pageData,
      queryData,
      generatedAt: new Date(),
    },
  });
}
