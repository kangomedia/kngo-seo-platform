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

// GET — Fetch Search Console data for the client
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

  if (!client?.gscProperty) {
    return NextResponse.json({ error: "No GSC property configured", connected: false }, { status: 400 });
  }

  const authClient = await getAuthenticatedClient(clientId);
  if (!authClient) {
    return NextResponse.json({ error: "Google not connected", connected: false }, { status: 401 });
  }

  try {
    const searchconsole = google.searchconsole({ version: "v1", auth: authClient });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const fmt = (d: Date) => d.toISOString().split("T")[0];

    // Top queries
    const queriesRes = await searchconsole.searchanalytics.query({
      siteUrl: client.gscProperty,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["query"],
        rowLimit: 20,
      },
    });

    // Top pages
    const pagesRes = await searchconsole.searchanalytics.query({
      siteUrl: client.gscProperty,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["page"],
        rowLimit: 20,
      },
    });

    // Daily performance
    const dailyRes = await searchconsole.searchanalytics.query({
      siteUrl: client.gscProperty,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["date"],
      },
    });

    return NextResponse.json({
      connected: true,
      property: client.gscProperty,
      dateRange: { start: fmt(startDate), end: fmt(endDate) },
      topQueries: (queriesRes.data.rows || []).map((r) => ({
        query: r.keys?.[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      topPages: (pagesRes.data.rows || []).map((r) => ({
        page: r.keys?.[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      daily: (dailyRes.data.rows || []).map((r) => ({
        date: r.keys?.[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
    });
  } catch (err) {
    console.error("[GSC API] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Search Console data", connected: true },
      { status: 500 }
    );
  }
}
