import { prisma } from "@/lib/prisma";

// ─── Google Data Fetchers ─────────────────────────────────

export async function fetchGSCData(clientId: string, gscProperty: string) {
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

export async function fetchGA4Data(clientId: string, ga4PropertyId: string) {
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
