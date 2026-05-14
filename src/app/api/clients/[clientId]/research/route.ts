import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validateBody } from "@/lib/validate";
import {
  parseClientPrimaryServices,
  parseClientServiceAreas,
  parseClientTargetCities,
  parseKeywordResearchResults,
} from "@/lib/parsers";
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
 * Body schema for `POST /api/clients/[clientId]/research`.
 *
 * Seeds are individual short phrases — DataForSEO rejects "keywords" longer
 * than ~80 chars, so we cap each seed there. Min length 2 stops degenerate
 * single-char seeds from burning DataForSEO calls.
 */
const ResearchPostSchema = z.object({
  seedTopics: z
    .array(z.string().trim().min(2).max(80))
    .min(1, "At least one seed topic is required"),
  location: z.string().trim().nullish(),
  context: z.string().nullish(),
});

/**
 * POST /api/clients/[clientId]/research
 * Run AI-powered keyword research using DataForSEO suggestions + the same
 * filter + AI scoring pipeline as the discover route, so manual research
 * sessions return the same quality of curated keywords.
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
  const validated = await validateBody(request, ResearchPostSchema);
  if (validated instanceof NextResponse) return validated;
  const { seedTopics, location, context } = validated;

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
      industrySector: true,
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
  // All Client JSON-column reads route through parsers.ts (CLAUDE.md Rule 1).
  const profile: BusinessProfile = {
    clientName: client.name,
    domain: client.domain || "",
    businessDescription: client.businessDescription,
    primaryServices: parseClientPrimaryServices(client.primaryServices),
    idealClientProfile: client.idealClientProfile,
    priceRange: client.priceRange,
    industryVertical: client.industryVertical || client.gbpCategory,
    industrySector: client.industrySector || null,
    serviceAreas: parseClientServiceAreas(client.serviceAreas),
    targetCities: parseClientTargetCities(client.targetCities),
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
      results: parseKeywordResearchResults(s.results),
    }))
  );
}
