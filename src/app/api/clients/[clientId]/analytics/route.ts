import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function getAuthenticatedClient(clientId: string) {
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

  // Auto-refresh if expired
  oauth2Client.on("tokens", async (newTokens: { access_token?: string | null; expiry_date?: number | null }) => {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runGA4Report(analyticsdata: any, propertyId: string, body: Record<string, unknown>) {
  const res = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: body,
  });
  return res.data;
}

// GET — Fetch GA4 analytics data for a client
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const client = await prisma.client.findUnique({ where: { id: clientId } });

  if (!client?.ga4PropertyId) {
    return NextResponse.json({ error: "No GA4 property configured", connected: false }, { status: 400 });
  }

  const authClient = await getAuthenticatedClient(clientId);
  if (!authClient) {
    return NextResponse.json({ error: "Google not connected", connected: false }, { status: 401 });
  }

  try {
    const analyticsdata = google.analyticsdata({ version: "v1beta", auth: authClient });
    const pid = client.ga4PropertyId;

    // Overview metrics (30 days)
    const overviewData = await runGA4Report(analyticsdata, pid, {
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "screenPageViews" },
      ],
    });

    // Traffic by source
    const sourceData = await runGA4Report(analyticsdata, pid, {
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      limit: "10",
    });

    // Top landing pages
    const pagesData = await runGA4Report(analyticsdata, pid, {
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "landingPage" }],
      metrics: [{ name: "sessions" }, { name: "bounceRate" }],
      limit: "15",
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    });

    // Daily sessions
    const dailyData = await runGA4Report(analyticsdata, pid, {
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    });

    interface GA4Row {
      dimensionValues?: { value?: string | null }[];
      metricValues?: { value?: string | null }[];
    }

    const parseRows = (rows: GA4Row[] | undefined) =>
      (rows || []).map((r: GA4Row) => ({
        dimensions: r.dimensionValues?.map((d) => d.value) || [],
        metrics: r.metricValues?.map((m) => parseFloat(m.value || "0")) || [],
      }));

    const overview = overviewData.rows?.[0];

    return NextResponse.json({
      connected: true,
      propertyId: client.ga4PropertyId,
      overview: {
        sessions: parseInt(overview?.metricValues?.[0]?.value || "0"),
        users: parseInt(overview?.metricValues?.[1]?.value || "0"),
        bounceRate: parseFloat(overview?.metricValues?.[2]?.value || "0"),
        avgSessionDuration: parseFloat(overview?.metricValues?.[3]?.value || "0"),
        pageViews: parseInt(overview?.metricValues?.[4]?.value || "0"),
      },
      trafficSources: parseRows(sourceData.rows).map((r) => ({
        channel: r.dimensions[0],
        sessions: r.metrics[0],
        users: r.metrics[1],
      })),
      topPages: parseRows(pagesData.rows).map((r) => ({
        page: r.dimensions[0],
        sessions: r.metrics[0],
        bounceRate: r.metrics[1],
      })),
      daily: parseRows(dailyData.rows).map((r) => ({
        date: r.dimensions[0],
        sessions: r.metrics[0],
        users: r.metrics[1],
      })),
    });
  } catch (err) {
    console.error("[GA4 API] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Analytics data", connected: true },
      { status: 500 }
    );
  }
}
