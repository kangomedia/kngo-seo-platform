import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** POST: Re-fetch search volume for all tracked keywords */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" &&
      session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  // Get all tracked keywords
  const keywords = await prisma.keyword.findMany({
    where: { clientId, isTracking: true },
    select: { id: true, keyword: true },
  });

  if (keywords.length === 0) {
    return NextResponse.json({ updated: 0, message: "No keywords to refresh" });
  }

  // DataForSEO credentials are read exclusively from environment variables.
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return NextResponse.json(
      { error: "DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables must be set." },
      { status: 400 }
    );
  }

  const encoded = Buffer.from(`${login}:${password}`).toString("base64");

  try {
    const response = await fetch(
      "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encoded}`,
        },
        body: JSON.stringify([
          {
            keywords: keywords.map((k) => k.keyword),
            location_code: 2840,
            language_code: "en",
          },
        ]),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `DataForSEO error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const results = data?.tasks?.[0]?.result || [];

    let updated = 0;
    for (const keyword of keywords) {
      const metric = results.find(
        (m: { keyword: string; search_volume?: number; competition_level?: number }) =>
          m.keyword?.toLowerCase() === keyword.keyword.toLowerCase()
      );
      if (metric) {
        await prisma.keyword.update({
          where: { id: keyword.id },
          data: {
            searchVolume: metric.search_volume || null,
            difficulty: metric.competition_level
              ? Math.round(metric.competition_level * 100)
              : null,
          },
        });
        updated++;
      }
    }

    return NextResponse.json({
      updated,
      total: keywords.length,
      message: `Updated metrics for ${updated} of ${keywords.length} keywords`,
    });
  } catch (err) {
    console.error("[METRICS] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch metrics from DataForSEO" },
      { status: 500 }
    );
  }
}
