// POST /api/clients/[clientId]/research/pain-point
//
// Demand-creation keyword research. Auto-generates seeds from the client's
// ICP pains + business profile (no user-supplied seeds), runs the standard
// DataForSEO + filter + AI scoring pipeline, and stores the result with
// mode: "PAIN_POINT" so downstream consumers (content map) can pull from it
// alongside the service-driven research.
//
// Body: { pillarSlug?: string, location?: string }

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  type BusinessProfile,
  type RawKeyword,
  filterByNegativePatterns,
  filterByGibberish,
  scoreKeywordRelevance,
  generatePainPointSeeds,
  generateStrategicAnalysis,
} from "@/lib/keyword-intelligence";

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
  const body = await request.json().catch(() => ({}));
  const pillarSlug: string | undefined = body.pillarSlug;
  const location: string | undefined = body.location;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
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
      icpPains: true,
    },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const dfLogin = process.env.DATAFORSEO_LOGIN;
  const dfPassword = process.env.DATAFORSEO_PASSWORD;
  const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  if (!claudeKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY required for pain-point research (it generates the seeds)" },
      { status: 500 }
    );
  }

  const parseList = (json: string | null): string[] => {
    try { return JSON.parse(json || "[]"); } catch { return []; }
  };
  const profile: BusinessProfile & { icpPains?: string[] } = {
    clientName: client.name,
    domain: client.domain || "",
    businessDescription: client.businessDescription,
    primaryServices: parseList(client.primaryServices),
    idealClientProfile: client.idealClientProfile,
    priceRange: client.priceRange,
    industryVertical: client.industryVertical || client.gbpCategory,
    serviceAreas: parseList(client.serviceAreas),
    targetCities: parseList(client.targetCities),
    icpPains: parseList(client.icpPains),
  };
  if (profile.targetCities.length === 0 && client.city && client.state) {
    profile.targetCities = [`${client.city}, ${client.state}`];
  }

  // ── Step 1: Generate pain-point seeds via Claude ──
  const seeds = await generatePainPointSeeds(profile, claudeKey);
  if (seeds.length === 0) {
    return NextResponse.json(
      { error: "Could not generate pain-point seeds — populate Top Pain Points or business profile first" },
      { status: 400 }
    );
  }

  // ── Step 2: Expand each seed via DataForSEO ──
  let allKeywords: RawKeyword[] = [];
  if (dfLogin && dfPassword) {
    const encoded = Buffer.from(`${dfLogin}:${dfPassword}`).toString("base64");

    for (const seed of seeds) {
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
                limit: 30,
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
            // Pain-point research is the TOFU funnel — long-tail queries with
            // 10–100 monthly searches are EXACTLY what we want. Filtering at
            // ≥50 here defeats the purpose (service research uses >0).
            // Keep ≥10 to drop pure noise but preserve real long-tail.
            if (kw && info && (info.search_volume || 0) >= 10) {
              allKeywords.push({
                keyword: kw,
                searchVolume: info.search_volume || 0,
                competition: Math.round((info.competition || 0) * 100),
                cpc: info.cpc || 0,
                source: `pain-seed:${seed}`,
                intent: intentInfo?.main_intent || null,
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[PAIN-RESEARCH] DataForSEO error for "${seed}":`, err instanceof Error ? err.message : err);
      }
    }

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

  // ── Step 3: Lighter filter pipeline ──
  // Pain-point research INTENTIONALLY keeps "informational" intent (TOFU).
  // We skip filterByIntent and filterByAudience (audience filter would drop
  // too many legitimate "how to" pain queries).
  let filtered = filterByNegativePatterns(allKeywords);
  filtered = filterByGibberish(filtered);

  // ── Step 4: AI relevance scoring ──
  let scored = filtered.map((kw) => ({
    ...kw,
    intent: kw.intent || "unknown",
    relevanceScore: 5,
    relevanceReason: "Default score — AI scoring not available",
    suggestedGroup: "Pain Point",
  }));
  if (claudeKey && filtered.length > 0) {
    const aiScored = await scoreKeywordRelevance(filtered, profile, claudeKey);
    if (aiScored.length > 0) scored = aiScored;
  }

  // Cap higher than service research (pain-point yields a wider funnel)
  const finalKeywords = scored.slice(0, 60);

  // ── Step 5: Strategic analysis ──
  let aiAnalysis: string | null = null;
  if (claudeKey && finalKeywords.length > 0) {
    try {
      aiAnalysis = await generateStrategicAnalysis(finalKeywords, profile, claudeKey);
    } catch (err) {
      console.warn("[PAIN-RESEARCH] strategic analysis failed:", err);
    }
  }

  // ── Step 6: Persist with mode tag ──
  const research = await prisma.keywordResearch.create({
    data: {
      clientId,
      mode: "PAIN_POINT",
      pillarSlug: pillarSlug || null,
      seedTopics: seeds.join(", "),
      location: location || (profile.targetCities[0] ?? "United States"),
      results: JSON.stringify(finalKeywords),
      aiAnalysis,
      keywordsFound: finalKeywords.length,
    },
  });

  return NextResponse.json({
    id: research.id,
    mode: "PAIN_POINT",
    seedsGenerated: seeds,
    keywordsFound: finalKeywords.length,
    keywords: finalKeywords,
    aiAnalysis,
    message: `Pain-point research: ${finalKeywords.length} demand-creation keywords from ${seeds.length} AI-generated seeds`,
  });
}
