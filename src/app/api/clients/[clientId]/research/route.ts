import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  type BusinessProfile,
  type RawKeyword,
  filterByNegativePatterns,
  filterByAudience,
  filterByGibberish,
  filterByIntent,
  scoreKeywordRelevance,
  generateStrategicAnalysis,
} from "@/lib/keyword-intelligence";

/**
 * POST /api/clients/[clientId]/research
 * Run AI-powered keyword research using DataForSEO suggestions + the same
 * filter + AI scoring pipeline as the discover route, so manual research
 * sessions return the same quality of curated keywords.
 *
 * Body: { seedTopics: string[], location?: string, context?: string }
 */
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
  const body = await request.json();
  const { seedTopics, location, context } = body;

  if (!seedTopics || !Array.isArray(seedTopics) || seedTopics.length === 0) {
    return NextResponse.json(
      { error: "seedTopics array is required" },
      { status: 400 }
    );
  }

  // Pull the full business profile so the AI scorer has the same context as
  // the discovery pipeline — without it, "score for THIS business" is hollow.
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      domain: true,
      city: true,
      state: true,
      gbpCategory: true,
      industryVertical: true,
      businessDescription: true,
      idealClientProfile: true,
      priceRange: true,
      primaryServices: true,
      serviceAreas: true,
      targetCities: true,
      notes: true,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const dfLogin = process.env.DATAFORSEO_LOGIN;
  const dfPassword = process.env.DATAFORSEO_PASSWORD;
  const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  // Build BusinessProfile for downstream scoring + seed generation parity.
  const parseList = (json: string | null): string[] => {
    try { return JSON.parse(json || "[]"); } catch { return []; }
  };
  const profile: BusinessProfile = {
    clientName: client.name,
    domain: client.domain || "",
    businessDescription: client.businessDescription,
    primaryServices: parseList(client.primaryServices),
    idealClientProfile: client.idealClientProfile,
    priceRange: client.priceRange,
    industryVertical: client.industryVertical || client.gbpCategory,
    serviceAreas: parseList(client.serviceAreas),
    targetCities: parseList(client.targetCities),
  };
  // Fill from city/state if targetCities is empty
  if (profile.targetCities.length === 0 && client.city && client.state) {
    profile.targetCities = [`${client.city}, ${client.state}`];
  }

  // ── Step 1: Fetch keyword suggestions from DataForSEO ──
  // Using `keywords_for_keywords` for ad-hoc seeded research. We also pull
  // search_intent_info so the intent filter can run downstream.
  let allKeywords: RawKeyword[] = [];

  if (dfLogin && dfPassword) {
    const encoded = Buffer.from(`${dfLogin}:${dfPassword}`).toString("base64");

    for (const seed of seedTopics.slice(0, 5)) {
      try {
        const res = await fetch(
          "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${encoded}`,
            },
            body: JSON.stringify([
              {
                keyword: seed.trim(),
                location_name: "United States",
                language_name: "English",
                include_seed_keyword: true,
                limit: 50,
              },
            ]),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const items = data?.tasks?.[0]?.result?.[0]?.items || [];

          for (const item of items) {
            const kw = item?.keyword;
            const info = item?.keyword_info;
            const intentInfo = item?.search_intent_info;
            if (kw && info && info.search_volume > 0) {
              allKeywords.push({
                keyword: kw,
                searchVolume: info.search_volume || 0,
                competition: Math.round((info.competition || 0) * 100),
                cpc: info.cpc || 0,
                source: `seed:${seed}`,
                intent: intentInfo?.main_intent || null,
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[RESEARCH] DataForSEO error for "${seed}":`, err instanceof Error ? err.message : err);
      }
    }

    // Dedupe by keyword (keep highest-volume occurrence)
    const seen = new Map<string, RawKeyword>();
    for (const kw of allKeywords) {
      const key = kw.keyword.toLowerCase();
      const existing = seen.get(key);
      if (!existing || kw.searchVolume > existing.searchVolume) {
        seen.set(key, kw);
      }
    }
    allKeywords = Array.from(seen.values());
  }

  // ── Step 2: Apply the same filter pipeline as discover ──
  // negative → audience → gibberish → intent
  let filtered = filterByNegativePatterns(allKeywords);
  filtered = filterByAudience(filtered);
  filtered = filterByGibberish(filtered);
  filtered = filterByIntent(filtered);

  // ── Step 3: AI relevance scoring (same scorer as discover) ──
  let scored = filtered.map((kw) => ({
    ...kw,
    intent: kw.intent || "unknown",
    relevanceScore: 5,
    relevanceReason: "Default score — AI scoring not available",
    suggestedGroup: "General",
  }));
  if (claudeKey && filtered.length > 0) {
    const aiScored = await scoreKeywordRelevance(filtered, profile, claudeKey);
    if (aiScored.length > 0) scored = aiScored;
  }

  // Cap at 40 — match the discover pipeline.
  const finalKeywords = scored.slice(0, 40);

  // ── Step 4: Strategic analysis ──
  let aiAnalysis: string | null = null;
  if (claudeKey && finalKeywords.length > 0) {
    try {
      aiAnalysis = await generateStrategicAnalysis(finalKeywords, profile, claudeKey);
    } catch (err) {
      console.warn("[RESEARCH] strategic analysis failed:", err instanceof Error ? err.message : err);
    }
  }

  // ── Step 5: Save research session ──
  const research = await prisma.keywordResearch.create({
    data: {
      clientId,
      seedTopics: seedTopics.join(", "),
      location: location || (profile.targetCities[0] ?? "United States"),
      results: JSON.stringify(finalKeywords),
      aiAnalysis,
      keywordsFound: finalKeywords.length,
    },
  });

  return NextResponse.json({
    id: research.id,
    keywordsFound: finalKeywords.length,
    keywords: finalKeywords,
    aiAnalysis,
    message: `Found ${finalKeywords.length} keywords from ${seedTopics.length} seed topics`,
    contextUsed: !!context,
  });
}

/**
 * GET /api/clients/[clientId]/research
 * Get all keyword research sessions for a client.
 */
export async function GET(
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

  const sessions = await prisma.keywordResearch.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json(
    sessions.map((s) => ({
      ...s,
      results: JSON.parse(s.results || "[]"),
    }))
  );
}
