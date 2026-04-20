import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/clients/[clientId]/research
 * Run AI-powered keyword research using DataForSEO suggestions + Claude analysis.
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

  // Get client info for context
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      domain: true,
      city: true,
      state: true,
      gbpCategory: true,
      notes: true,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Get credentials
  const settings = await prisma.agencySettings.findUnique({
    where: { id: "default" },
  });

  const dfLogin = process.env.DATAFORSEO_LOGIN || settings?.dataforseoLogin;
  const dfPassword = process.env.DATAFORSEO_PASSWORD || settings?.dataforseoPwd;
  const claudeKey = process.env.CLAUDE_API_KEY || settings?.claudeApiKey;

  // Step 1: Fetch keyword suggestions from DataForSEO
  let allKeywords: Array<{
    keyword: string;
    searchVolume: number;
    competition: number;
    cpc: number;
    categories: string[];
  }> = [];

  if (dfLogin && dfPassword) {
    const encoded = Buffer.from(`${dfLogin}:${dfPassword}`).toString("base64");

    // Use keyword suggestions for each seed topic
    for (const seed of seedTopics.slice(0, 5)) {
      try {
        const res = await fetch(
          "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${encoded}`,
            },
            body: JSON.stringify([
              {
                keywords: [seed.trim()],
                location_code: 2840,
                language_code: "en",
                include_seed_keyword: true,
                sort_by: "search_volume",
              },
            ]),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const results = data?.tasks?.[0]?.result || [];

          for (const item of results) {
            if (item.keyword && item.search_volume > 0) {
              allKeywords.push({
                keyword: item.keyword,
                searchVolume: item.search_volume || 0,
                competition: item.competition
                  ? Math.round(item.competition * 100)
                  : 0,
                cpc: item.cpc || 0,
                categories: item.keyword_annotations?.categories?.map(
                  (c: { name: string }) => c.name
                ) || [],
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[RESEARCH] DataForSEO error for "${seed}":`, err instanceof Error ? err.message : err);
      }
    }

    // Deduplicate by keyword
    const seen = new Set<string>();
    allKeywords = allKeywords.filter((kw) => {
      const key = kw.keyword.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by search volume descending
    allKeywords.sort((a, b) => b.searchVolume - a.searchVolume);

    // Cap at top 100 keywords
    allKeywords = allKeywords.slice(0, 100);
  }

  // Step 2: AI Analysis — Score keywords by ROI and provide strategy
  let aiAnalysis: string | null = null;

  if (claudeKey && allKeywords.length > 0) {
    try {
      const locationStr = client.city && client.state
        ? `${client.city}, ${client.state}`
        : location || "United States";

      const prompt = `You are an expert SEO strategist for local businesses. Analyze these keyword research results for a client and provide strategic recommendations.

## Client Profile
- **Business:** ${client.name}
- **Website:** ${client.domain || "Not provided"}
- **Location:** ${locationStr}
- **Industry/Category:** ${client.gbpCategory || "Not specified"}
- **Additional Context:** ${context || client.notes || "None"}
- **Seed Topics:** ${seedTopics.join(", ")}

## Keyword Data (Top ${allKeywords.length} keywords)
${allKeywords.map((kw, i) => `${i + 1}. "${kw.keyword}" — Vol: ${kw.searchVolume}, Competition: ${kw.competition}%, CPC: $${kw.cpc.toFixed(2)}`).join("\n")}

## Your Task
1. **ROI Ranking:** Score each keyword 1-100 based on ROI potential (considering volume, competition, commercial intent, and relevance to this specific business). Output the top 20 highest-ROI keywords.

2. **Topic Clusters:** Group the top keywords into 3-5 topical clusters/themes that could form pillar content strategies.

3. **Content Recommendations:** For each cluster, suggest:
   - 1 pillar blog post idea (long-form, 1500+ words)
   - 2-3 supporting content ideas (GBP posts, Q&As, shorter blogs)
   - 1 press release angle

4. **Quick Wins:** Identify 3-5 keywords that are low competition + decent volume = fastest to rank for.

5. **Strategic Summary:** 2-3 paragraph overview of the recommended keyword strategy.

Respond in well-structured markdown.`;

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (claudeRes.ok) {
        const claudeData = await claudeRes.json();
        aiAnalysis =
          claudeData.content?.[0]?.text || null;
      }
    } catch (err) {
      console.warn("[RESEARCH] Claude AI analysis error:", err instanceof Error ? err.message : err);
    }
  }

  // Step 3: Save research session
  const research = await prisma.keywordResearch.create({
    data: {
      clientId,
      seedTopics: seedTopics.join(", "),
      location: location || "United States",
      results: JSON.stringify(allKeywords),
      aiAnalysis,
      keywordsFound: allKeywords.length,
    },
  });

  return NextResponse.json({
    id: research.id,
    keywordsFound: allKeywords.length,
    keywords: allKeywords,
    aiAnalysis,
    message: `Found ${allKeywords.length} keywords from ${seedTopics.length} seed topics`,
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
