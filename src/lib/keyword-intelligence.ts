/**
 * keyword-intelligence.ts
 * 
 * AI-powered keyword research pipeline that replaces generic DataForSEO
 * keywords_for_site with an intent-filtered, business-aware approach.
 * 
 * Three-stage filtering:
 *   1. Negative pattern filter (regex) — removes garbage keywords
 *   2. Intent filter — keeps only commercial/transactional intent
 *   3. AI relevance scorer (Claude) — scores each keyword 1-10 for business fit
 */

// ─── Types ───────────────────────────────────────────────

export interface BusinessProfile {
  businessDescription: string | null;
  primaryServices: string[];
  idealClientProfile: string | null;
  priceRange: string | null;
  industryVertical: string | null;
  serviceAreas: string[];
  targetCities: string[];
  clientName: string;
  domain: string;
}

export interface RawKeyword {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
  source: string;
  intent?: string | null;
}

export interface ScoredKeyword extends RawKeyword {
  intent: string;
  relevanceScore: number;
  relevanceReason: string;
  suggestedGroup: string;
}

// ─── Negative Keyword Patterns ───────────────────────────

/**
 * Keywords matching any of these patterns are immediately dropped.
 * These represent queries that are never relevant for a service-based
 * business client (DIY, tutorials, competitor platforms, games, jobs, etc.)
 */
const NEGATIVE_PATTERNS: RegExp[] = [
  /\bfree\b/i,
  /\bdiy\b/i,
  /\btutorial[s]?\b/i,
  /\bhow to\b/i,
  /\bhow do\b/i,
  /\bwhat is\b/i,
  /\breddit\b/i,
  /\bquora\b/i,
  /\bwix\b/i,
  /\bwordpress\.com\b/i,
  /\bsquarespace\b/i,
  /\bweebly\b/i,
  /\bwixsite\b/i,
  /\bgodaddy\b/i,
  /\bshopify\b/i,
  /\btemplate[s]?\b/i,
  /\bcourse[s]?\b/i,
  /\blearn\b/i,
  /\bsalary\b/i,
  /\bjob[s]?\b/i,
  /\bhiring\b/i,
  /\bintern(ship)?\b/i,
  /\bcareer[s]?\b/i,
  /\bresume\b/i,
  /\bopen[\s-]?source\b/i,
  /\bgithub\b/i,
  /\bstack[\s-]?overflow\b/i,
  /\bwordle\b/i,
  /\bgame[s]?\b/i,
  /\bdownload\b/i,
  /\bcrack\b/i,
  /\btorrent\b/i,
  /\bplugin[s]?\b/i,
  /\bextension[s]?\b/i,
  /\blogo[\s-]?maker\b/i,
  /\bai\s+(generator|maker|creator|builder|writer)\b/i,
  /\bonline\s+(free|tool|maker|generator|converter)\b/i,
  /\b(make|create|build)\s+(your\s+own|a|my)\b/i,
  /\bfreelance[r]?\b/i,
  /\bcheap(est)?\b/i,
  /\b(example|sample|demo)[s]?\b/i,
  /\bmeaning\b/i,
  /\bdefinition\b/i,
  /\bvs\b/i,
  /\bcomparison\b/i,
  /\balternative[s]?\b/i,
  /\breview[s]?\b/i,
  /\bpdf\b/i,
  /\b(youtube|tiktok|instagram)\b/i,
];

/**
 * Filter out keywords that match negative patterns.
 * Returns only keywords that pass all pattern checks.
 */
export function filterByNegativePatterns(keywords: RawKeyword[]): RawKeyword[] {
  return keywords.filter((kw) => {
    return !NEGATIVE_PATTERNS.some((pattern) => pattern.test(kw.keyword));
  });
}

// ─── Intent Filter ───────────────────────────────────────

/**
 * Valid intent values from DataForSEO's search_intent_info.main_intent.
 * We keep commercial and transactional; drop informational and navigational.
 * 
 * Exception: Informational keywords with high CPC (>$10) are kept because
 * high CPC signals commercial value despite the intent classification.
 */
export function filterByIntent(keywords: RawKeyword[]): RawKeyword[] {
  return keywords.filter((kw) => {
    const intent = (kw.intent || "").toLowerCase();

    // Always keep commercial and transactional
    if (intent === "commercial" || intent === "transactional") return true;

    // Keep informational ONLY if CPC signals real commercial value
    if (intent === "informational" && kw.cpc >= 10) return true;

    // Drop navigational entirely
    if (intent === "navigational") return false;

    // If no intent data, use CPC as a proxy: CPC > $3 = likely commercial
    if (!intent || intent === "undefined") {
      return kw.cpc >= 3;
    }

    return false;
  });
}

// ─── Smart Seed Generator ────────────────────────────────

/**
 * Buying-intent modifiers that indicate someone is ready to purchase
 * a service rather than just researching.
 */
const BUYING_MODIFIERS = [
  "hire", "company", "near me", "services", "contractor",
  "cost", "pricing", "best", "top", "professional",
  "agency", "firm", "expert", "specialist",
];

const LOCAL_MODIFIERS = [
  "near me", "in {city}", "{city}", "{city} {state}",
];

/**
 * Generate intelligent seed keywords based on business profile.
 * Combines primary services with buying-intent modifiers and location data
 * to produce seed phrases that attract high-ROI keywords.
 */
export function generateSmartSeeds(profile: BusinessProfile): string[] {
  const seeds: string[] = [];
  const services = profile.primaryServices.length > 0
    ? profile.primaryServices
    : profile.serviceAreas.length > 0
      ? profile.serviceAreas
      : [profile.clientName];

  // Core service seeds
  for (const service of services.slice(0, 5)) {
    seeds.push(service);
  }

  // Service + buying modifier combinations
  for (const service of services.slice(0, 3)) {
    for (const mod of BUYING_MODIFIERS.slice(0, 6)) {
      seeds.push(`${service} ${mod}`);
    }
  }

  // Location-qualified seeds
  const primaryCity = profile.targetCities[0] || null;
  if (primaryCity) {
    for (const service of services.slice(0, 3)) {
      seeds.push(`${service} ${primaryCity}`);
      seeds.push(`${service} near me`);
      seeds.push(`best ${service} ${primaryCity}`);
    }
  }

  // Industry-specific seeds
  if (profile.industryVertical) {
    for (const service of services.slice(0, 2)) {
      seeds.push(`${profile.industryVertical} ${service}`);
      seeds.push(`${service} for ${profile.industryVertical.toLowerCase()}`);
    }
  }

  // Deduplicate and limit
  const unique = [...new Set(seeds.map(s => s.toLowerCase().trim()))];
  return unique.slice(0, 20);
}

// ─── AI Relevance Scorer ─────────────────────────────────

/**
 * Use Claude to score each keyword's relevance to the business.
 * Returns keywords with relevanceScore, reasoning, and suggested group.
 * 
 * Keywords scoring < 4 are dropped entirely.
 */
export async function scoreKeywordRelevance(
  keywords: RawKeyword[],
  profile: BusinessProfile,
  anthropicKey: string,
): Promise<ScoredKeyword[]> {
  if (keywords.length === 0) return [];

  // Build business context for Claude
  const businessContext = [
    `Business: ${profile.clientName}`,
    `Website: ${profile.domain}`,
    profile.businessDescription ? `Description: ${profile.businessDescription}` : null,
    profile.primaryServices.length > 0 ? `Core Services: ${profile.primaryServices.join(", ")}` : null,
    profile.idealClientProfile ? `Ideal Client: ${profile.idealClientProfile}` : null,
    profile.priceRange ? `Price Range: ${profile.priceRange}` : null,
    profile.industryVertical ? `Industry: ${profile.industryVertical}` : null,
    profile.serviceAreas.length > 0 ? `Service Areas: ${profile.serviceAreas.join(", ")}` : null,
    profile.targetCities.length > 0 ? `Target Cities: ${profile.targetCities.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  // Take top 100 by a balanced score (volume * cpc weight)
  const toScore = keywords
    .sort((a, b) => {
      const scoreA = Math.log(a.searchVolume + 1) * (a.cpc + 1);
      const scoreB = Math.log(b.searchVolume + 1) * (b.cpc + 1);
      return scoreB - scoreA;
    })
    .slice(0, 100);

  const kwList = toScore.map((kw, i) =>
    `${i + 1}. "${kw.keyword}" — Vol: ${kw.searchVolume}, CPC: $${kw.cpc.toFixed(2)}, Competition: ${kw.competition}%, Intent: ${kw.intent || "unknown"}`
  ).join("\n");

  const prompt = `You are an SEO strategist evaluating keyword relevance for a specific business.

BUSINESS PROFILE:
${businessContext}

KEYWORDS TO EVALUATE:
${kwList}

For each keyword, provide:
1. relevanceScore (1-10): How relevant is this keyword to THIS specific business?
   - 9-10: Perfect match — directly describes their service/product
   - 7-8: Strong match — closely related to their offerings
   - 5-6: Moderate match — tangentially related, could bring good leads
   - 3-4: Weak match — mostly irrelevant but has some connection
   - 1-2: No match — completely unrelated to this business
2. reason: One sentence explaining the score
3. group: Assign a topic group (e.g., "Core Services", "Location", "Service Variation", "Competitor Gap", "Long-tail Opportunity")

Respond ONLY with a JSON array. No markdown, no explanation. Just the array:
[{"index":1,"score":8,"reason":"Directly matches their core offering","group":"Core Services"},...]

IMPORTANT: Be strict. If a keyword wouldn't bring a qualified lead to THIS business, score it low. A web development company doesn't need keywords about "wordle" or "build website with wix" — those are DIY searches, not buyers.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error(`[KW-INTEL] Claude API error: ${res.status}`);
      // Return keywords with default scores
      return toScore.map(kw => ({
        ...kw,
        intent: kw.intent || "unknown",
        relevanceScore: 5,
        relevanceReason: "AI scoring unavailable — default score applied",
        suggestedGroup: "Uncategorized",
      }));
    }

    const data = await res.json();
    const rawText = data?.content?.[0]?.text || "";

    // Parse JSON — handle potential markdown wrapping
    let scores: Array<{ index: number; score: number; reason: string; group: string }> = [];
    try {
      const jsonStr = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      scores = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("[KW-INTEL] Failed to parse Claude response:", parseErr);
      // Fallback: return all with default score
      return toScore.map(kw => ({
        ...kw,
        intent: kw.intent || "unknown",
        relevanceScore: 5,
        relevanceReason: "AI scoring parse error — default score applied",
        suggestedGroup: "Uncategorized",
      }));
    }

    // Map scores back to keywords
    const scored: ScoredKeyword[] = [];
    for (const s of scores) {
      const idx = s.index - 1;
      if (idx >= 0 && idx < toScore.length && s.score >= 4) {
        scored.push({
          ...toScore[idx],
          intent: toScore[idx].intent || "unknown",
          relevanceScore: s.score,
          relevanceReason: s.reason || "",
          suggestedGroup: s.group || "General",
        });
      }
    }

    // Sort by composite score: relevance * log(volume)
    scored.sort((a, b) => {
      const sa = a.relevanceScore * Math.log(a.searchVolume + 1);
      const sb = b.relevanceScore * Math.log(b.searchVolume + 1);
      return sb - sa;
    });

    return scored;
  } catch (err) {
    console.error("[KW-INTEL] AI scoring failed:", err);
    return toScore.map(kw => ({
      ...kw,
      intent: kw.intent || "unknown",
      relevanceScore: 5,
      relevanceReason: "AI scoring error — default score applied",
      suggestedGroup: "Uncategorized",
    }));
  }
}

// ─── Strategic Analysis ──────────────────────────────────

/**
 * Generate a strategic AI analysis of the scored keywords.
 * This replaces the previous generic analysis with one that's
 * aware of the business profile and scoring results.
 */
export async function generateStrategicAnalysis(
  keywords: ScoredKeyword[],
  profile: BusinessProfile,
  anthropicKey: string,
): Promise<string | null> {
  if (keywords.length === 0) return null;

  const businessContext = [
    `Business: ${profile.clientName} (${profile.domain})`,
    profile.businessDescription || null,
    profile.idealClientProfile ? `Ideal Client: ${profile.idealClientProfile}` : null,
    profile.priceRange ? `Price Range: ${profile.priceRange}` : null,
    profile.industryVertical ? `Industry: ${profile.industryVertical}` : null,
  ].filter(Boolean).join("\n");

  const kwSummary = keywords.slice(0, 40).map((kw, i) =>
    `${i + 1}. "${kw.keyword}" — Relevance: ${kw.relevanceScore}/10, Vol: ${kw.searchVolume}, CPC: $${kw.cpc.toFixed(2)}, Group: ${kw.suggestedGroup}`
  ).join("\n");

  // Count by group
  const groups = new Map<string, number>();
  keywords.forEach(kw => {
    groups.set(kw.suggestedGroup, (groups.get(kw.suggestedGroup) || 0) + 1);
  });
  const groupSummary = Array.from(groups.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([g, c]) => `${g}: ${c} keywords`)
    .join(", ");

  const prompt = `You are an SEO strategist preparing a keyword research summary for a client.

BUSINESS PROFILE:
${businessContext}

KEYWORD GROUPS FOUND: ${groupSummary}

TOP KEYWORDS (sorted by relevance × search volume):
${kwSummary}

Write a strategic analysis (3-5 paragraphs) covering:
1. **Top Priority Keywords** — The 5-8 keywords they should track immediately and why
2. **Quick Wins** — Keywords where they likely have some presence already
3. **Content Strategy** — Blog topics and landing pages they should create based on these keywords
4. **Local SEO** — Location-specific opportunities they should capitalize on
5. **Next Steps** — Concrete actions for month 1 of their SEO campaign

Be specific, mention actual keywords by name, and explain WHY each recommendation matters for their specific business type. Write for a business owner, not an SEO expert.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data?.content?.[0]?.text || null;
    }
    return null;
  } catch (err) {
    console.error("[KW-INTEL] Strategic analysis error:", err);
    return null;
  }
}
