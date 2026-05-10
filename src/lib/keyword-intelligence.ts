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
 * UNIVERSAL negative patterns — only things that are NEVER relevant
 * for ANY legitimate business client. Industry-specific filtering
 * is handled by the AI relevance scorer (Stage 6) which has full
 * business context.
 *
 * DO NOT add industry-specific terms here (e.g. "wix", "shopify",
 * "freelance", "template", "game"). A Shopify agency WANTS "shopify"
 * keywords, a game studio WANTS "game" keywords, etc.
 */
const NEGATIVE_PATTERNS: RegExp[] = [
  // Piracy / illegal
  /\bcrack(ed)?\b/i,
  /\btorrent[s]?\b/i,
  /\bpirat(e|ed|ing)\b/i,
  /\bkeygen\b/i,

  // Explicit / spam
  /\bxxx\b/i,
  /\bporn\b/i,

  // Noise that pollutes any business keyword list
  /\bwordle\b/i,
  /\breddit\b/i,
  /\bquora\b/i,
  /\b(youtube|tiktok|instagram)\b/i,
];

/**
 * Filter out keywords that match universal negative patterns.
 * This is intentionally a SMALL list — business-specific relevance
 * filtering is handled by the AI scorer, which knows the client's
 * industry, services, and ideal customer profile.
 */
export function filterByNegativePatterns(keywords: RawKeyword[]): RawKeyword[] {
  return keywords.filter((kw) => {
    return !NEGATIVE_PATTERNS.some((pattern) => pattern.test(kw.keyword));
  });
}

// ─── Audience Filter ─────────────────────────────────────

/**
 * Wrong-audience patterns: keywords searched by people who are NOT prospects
 * for a service business. These exit the funnel before they ever convert:
 *   - Students/learners ("course", "tutorial", "how to learn")
 *   - DIY ("diy", "make your own")
 *   - Job-seekers ("salary", "jobs", "intern")
 *   - Self-study materials ("template", "ebook", "cheat sheet")
 *
 * If you ever onboard a client whose business genuinely targets these people
 * (an online course, a job board), this filter would need a per-client opt-out.
 * For service-business clients — which is everyone the platform is built for —
 * blocking these immediately removes ~70% of the noise from DataForSEO's
 * keyword expansion.
 */
const AUDIENCE_NEGATIVE_PATTERNS: RegExp[] = [
  // Educational / training / certification — they want to learn, not hire
  /\b(courses?|tutorial[s]?|trainings?|bootcamps?|classes?|lessons?|webinars?|syllabus|curriculum)\b/i,
  /\b(certification|certificates?|certified|practice test|quiz(z?es)?)\b/i,
  /\bhow to (learn|become|build|make|do|start|teach|study|create|design|develop|code|program)\b/i,
  /\b(learn|teach|study) (about|how|to)\b/i,
  /\bbeginner[s']?\b/i,

  // DIY / self-service — they're going to do it themselves
  /\b(diy|do it yourself)\b/i,
  /\b(make|build|create) your own\b/i,

  // Job-seekers / career questions — wrong end of the market
  /\b(salary|salaries|wages?|hourly rate|pay ?scale)\b/i,
  /\b(jobs?|career[s]?|hiring|recruit(er|ment|ing)?)\b/i,
  /\bintern(ship[s]?)?\b/i,
  /\bresume[s]?\b/i,
  /\b(vacancy|vacancies|employment|employer)\b/i,

  // Self-study materials / freebies that are not commercial
  /\b(template[s]?|samples?|examples?|demos?)\b/i,
  /\b(books?|ebooks?|pdfs?|cheat[- ]?sheets?)\b/i,

  // Pure informational query forms (handled here only when keyword starts
  // with these — "cost of X" style phrases are still allowed)
  /^what (is|are|does|was|were|do|don't|doesn't)\b/i,
  /^why (is|are|does|do|don't|doesn't)\b/i,
];

export function filterByAudience(keywords: RawKeyword[]): RawKeyword[] {
  return keywords.filter((kw) => {
    return !AUDIENCE_NEGATIVE_PATTERNS.some((pattern) => pattern.test(kw.keyword));
  });
}

/**
 * Filter out gibberish keywords from DataForSEO's keyword expansion that are
 * just repeated words or near-duplicates ("web design web design web development",
 * "design in web design"). Heuristic: any non-stop-word that appears 2+ times
 * is treated as keyword stuffing and dropped.
 */
const STOP_WORDS = new Set([
  "the", "a", "an", "in", "for", "of", "to", "with", "and", "or", "on", "at", "by", "is", "are",
]);

export function filterByGibberish(keywords: RawKeyword[]): RawKeyword[] {
  return keywords.filter((kw) => {
    const words = kw.keyword
      .toLowerCase()
      .split(/[\s\-]+/)
      .filter((w) => w && !STOP_WORDS.has(w));
    if (words.length < 2) return true; // single-word keywords aren't gibberish
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    for (const c of counts.values()) {
      if (c >= 2) return false; // repeated content word = keyword stuffing
    }
    return true;
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

/**
 * Ask Claude to propose 20 high-quality seed phrases tailored to the
 * business profile. This is the preferred path when an Anthropic key is
 * configured — Claude understands buying intent and customer journey
 * context that mechanical templates can't reproduce.
 *
 * Falls back to `generateSmartSeeds` if the request fails for any reason.
 */
export async function generateAISeeds(
  profile: BusinessProfile,
  anthropicKey: string,
): Promise<string[]> {
  const cityLine = profile.targetCities[0] || "(no city specified)";
  const profileLines = [
    `Business: ${profile.clientName}`,
    profile.businessDescription ? `What they do: ${profile.businessDescription}` : null,
    profile.primaryServices.length > 0 ? `Services: ${profile.primaryServices.join(", ")}` : null,
    profile.idealClientProfile ? `Ideal customer: ${profile.idealClientProfile}` : null,
    profile.industryVertical ? `Industry vertical: ${profile.industryVertical}` : null,
    profile.serviceAreas.length > 0 ? `Service areas: ${profile.serviceAreas.join(", ")}` : null,
    `Primary city: ${cityLine}`,
  ].filter(Boolean).join("\n");

  const prompt = `You are an SEO strategist preparing seed keywords for a LOCAL SERVICE BUSINESS that sells to paying customers in ${cityLine}.

BUSINESS PROFILE:
${profileLines}

Produce 20 seed phrases that, when expanded by a keyword research tool, will yield keywords a real prospect would actually search before HIRING this business. Cover this mix across the 20:

  - 5–7 LOCAL MONEY phrases ("{service} {city}", "best {service} near me", "{service} agency {city}", "hire {service} {city}")
  - 4–6 SERVICE COMMERCIAL phrases ("{service} cost", "{service} pricing", "{service} services", "{service} company")
  - 3–5 VERTICAL-SPECIFIC phrases tied to the business's actual ideal customer ("{service} for {vertical}", "{vertical} {service}")
  - 3–5 TOP-OF-FUNNEL problem-aware phrases real prospects have right before buying ("how to choose a {service}", "{service} vs alternative")

Rules — do not break these:
  - Each seed must look like something a paying customer would actually type
  - DO NOT include educational ("course", "tutorial", "how to learn"), DIY ("make your own"), or job-seeker ("salary", "jobs") phrases
  - DO NOT include single-word generic terms unless paired with a qualifier
  - Use the business's exact service names where possible
  - Lowercase, trimmed, no punctuation other than spaces

Respond with a JSON array of 20 strings only — no prose, no markdown, no code fences.
Example shape: ["wordpress developer denver", "best web design agency colorado", ...]`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
    const data = await res.json();
    const text = (data?.content?.[0]?.text || "").trim();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const seeds = JSON.parse(cleaned);
    if (!Array.isArray(seeds)) throw new Error("Not an array");
    const filtered = seeds
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.toLowerCase().trim())
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 20);
    if (filtered.length === 0) throw new Error("Empty seed list");
    return filtered;
  } catch (err) {
    console.warn("[KW-INTEL] generateAISeeds fell back to mechanical seeds:", err instanceof Error ? err.message : err);
    return generateSmartSeeds(profile);
  }
}

// ─── Pain-Point Seed Generator ───────────────────────────
//
// Demand-creation seeds: works backwards from the ICP's *problems*, not the
// agency's services. Produces TOFU/MOFU keyword candidates that target
// people who don't yet know the agency's category exists but are searching
// for the pain or the comparison they're already in.

export async function generatePainPointSeeds(
  profile: BusinessProfile & { icpPains?: string[] },
  anthropicKey: string,
): Promise<string[]> {
  const painLines = (profile.icpPains || []).filter(Boolean);
  const profileLines = [
    `Business: ${profile.clientName}`,
    profile.businessDescription ? `What they do: ${profile.businessDescription}` : null,
    profile.primaryServices.length > 0 ? `Services: ${profile.primaryServices.join(", ")}` : null,
    profile.idealClientProfile ? `Ideal customer: ${profile.idealClientProfile}` : null,
    profile.industryVertical ? `Industry vertical: ${profile.industryVertical}` : null,
    painLines.length > 0 ? `ICP pain points (verbatim from the agency):\n  - ${painLines.join("\n  - ")}` : null,
  ].filter(Boolean).join("\n");

  const verticalNudge = profile.industryVertical
    ? `\nIMPORTANT: This business operates in **${profile.industryVertical}**. Generate seeds in the language THIS vertical's customers use — not generic SaaS or service-business automation phrases. A customer's vocabulary in this industry is specific (e.g. an HVAC homeowner doesn't search the same terms as a personal-injury claimant).`
    : "";

  const prompt = `You are an SEO strategist generating DEMAND-CREATION SEED keywords for top-of-funnel and middle-of-funnel content. These will be EXPANDED by a keyword research tool (DataForSEO) into related queries — so the seeds themselves need to be **short, head-term phrases** that the tool can match against its index, NOT long descriptive sentences.

BUSINESS PROFILE:
${profileLines}
${verticalNudge}

CRITICAL CONSTRAINT — seed length:
**Most seeds must be 2–5 words.** A few may go up to 7 words for very specific intent. Never longer.

Why: DataForSEO can't expand a 10-word descriptive sentence (e.g. "office admin spending all day on follow up emails" returns nothing). It CAN expand a 3-word head term (e.g. "follow up automation" returns dozens of related queries with real volume). The seed is a starting point for expansion — be a fishing rod, not a fish.

Produce 25 seeds across these four angles. **All examples must be invented fresh from THIS business's profile and vertical — do not copy the structural placeholders below.**

  - 6–8 PAIN head terms (2–4 words) — short phrases naming the problem. Shape: "[problem]", "[problem] [vertical]", "missed [thing]", "slow [thing]". The pain itself, not a sentence about it.
  - 5–7 OUTCOME head terms (2–5 words) — what people search for the result. Shape: "automated [thing]", "[fast/easy] [outcome]", "[outcome] software/tool/system".
  - 5–7 COMPARISON head terms (3–6 words) — Shape: "[brand A] vs [brand B]", "best [category] for [vertical]", "[category] reviews", "[category] alternatives".
  - 3–5 EDUCATIONAL head terms (2–5 words) — Shape: "what is [concept]", "how [concept] works", "[concept] explained", "[concept] guide".

Rules:
  - SHORT phrases. If your seed has more than 6 words, rewrite it shorter.
  - DO NOT include the agency's/business's name or city
  - DO NOT include educational/job/DIY phrases like "course", "salary", "make your own"
  - DO NOT use phrases that are obviously vendor/tooling jargon when the customer wouldn't. Only use vendor-tool phrases if the buyer for this business IS another business shopping for that tool (B2B SaaS).
  - Prefer vertical-specific phrasings over generic ones when the ideal customer is a vertical (e.g. "hvac scheduling software" beats "scheduling software")
  - Lowercase, trimmed, no punctuation other than spaces

Respond with a JSON array of 25 strings only — no prose, no markdown, no code fences.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
    const data = await res.json();
    const text = (data?.content?.[0]?.text || "").trim();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const seeds = JSON.parse(cleaned);
    if (!Array.isArray(seeds)) throw new Error("Not an array");
    const filtered = seeds
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.toLowerCase().trim())
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 25);
    if (filtered.length === 0) throw new Error("Empty seed list");
    return filtered;
  } catch (err) {
    console.warn("[KW-INTEL] generatePainPointSeeds failed:", err instanceof Error ? err.message : err);
    // Fall back to literal user-supplied pains as seeds
    return painLines.slice(0, 12);
  }
}

// ─── AI Relevance Scorer ─────────────────────────────────

/**
 * Pre-AI relevance score. Used to pick the 100 keywords we send to Claude
 * for full scoring. The previous version sorted by volume × CPC, which
 * meant the 100 we picked were "the highest-volume garbage." This version
 * boosts keywords that look local + commercial + service-aligned, and
 * penalizes generic single/double-word terms that don't qualify the search.
 */
function preRelevanceScore(kw: RawKeyword, profile: BusinessProfile): number {
  const lc = kw.keyword.toLowerCase();
  let score = Math.log(kw.searchVolume + 1) + kw.cpc * 0.5;

  // Geo signal — strongest indicator that the searcher is local
  const cities = profile.targetCities.map((c) => c.split(",")[0].trim().toLowerCase()).filter(Boolean);
  if (cities.some((c) => c && lc.includes(c))) score += 5;
  const states = profile.targetCities
    .map((c) => c.split(",")[1]?.trim().toLowerCase())
    .filter(Boolean) as string[];
  if (states.some((s) => lc.includes(s))) score += 2;
  if (/\bnear me\b/i.test(kw.keyword)) score += 4;

  // Buying / commercial qualifier — "hire", "best", "agency", "cost"
  const BUYING_TERMS = /\b(hire|agency|company|firm|services?|cost|costs|price|pricing|rates?|quote|estimate|best|top|professional|experts?|specialists?)\b/i;
  if (BUYING_TERMS.test(kw.keyword)) score += 3;

  // Industry vertical match (e.g. "for plumbers", "hvac", "contractor")
  if (profile.industryVertical) {
    const v = profile.industryVertical.toLowerCase();
    if (lc.includes(v)) score += 3;
  }

  // Service-name match — keyword references one of their services
  for (const s of profile.primaryServices) {
    const svc = s.toLowerCase();
    if (svc && lc.includes(svc)) {
      score += 1;
      break;
    }
  }

  // Penalty: too short / too generic. A two-word keyword with no local or
  // buying qualifier ("web design", "lawn care") is a national-generic term
  // a small business will never rank for — push it out of the top 100.
  const words = lc.split(/\s+/).filter(Boolean);
  const hasQualifier =
    BUYING_TERMS.test(kw.keyword) ||
    /\bnear me\b/i.test(kw.keyword) ||
    cities.some((c) => c && lc.includes(c)) ||
    states.some((s) => lc.includes(s));
  if (words.length <= 2 && !hasQualifier) score -= 3;

  return score;
}

/**
 * Use Claude to score each keyword's relevance to the business.
 * Returns keywords with relevanceScore, reasoning, and suggested group.
 *
 * Keywords scoring < 5 are dropped entirely (was 4 — bumped up to push
 * mediocre matches out of the final list).
 */
export async function scoreKeywordRelevance(
  keywords: RawKeyword[],
  profile: BusinessProfile,
  anthropicKey: string,
): Promise<ScoredKeyword[]> {
  if (keywords.length === 0) return [];

  // Build business context for Claude
  const cityLabel = profile.targetCities.length > 0 ? profile.targetCities[0] : "their service area";
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

  // Pick the 100 most LOCALLY + COMMERCIALLY promising keywords. Bias
  // selection toward geo-anchored, buying-intent terms before AI scoring.
  const toScore = keywords
    .map((kw) => ({ kw, s: preRelevanceScore(kw, profile) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 100)
    .map((x) => x.kw);

  const kwList = toScore.map((kw, i) =>
    `${i + 1}. "${kw.keyword}" — Vol: ${kw.searchVolume}, CPC: $${kw.cpc.toFixed(2)}, Competition: ${kw.competition}%, Intent: ${kw.intent || "unknown"}`
  ).join("\n");

  const prompt = `You are an SEO strategist scoring keywords for a LOCAL SERVICE BUSINESS that wants to attract paying clients in ${cityLabel} through content marketing.

BUSINESS PROFILE:
${businessContext}

KEYWORDS TO EVALUATE:
${kwList}

────────────────────────────────────────────────────────
SCORING RUBRIC — read carefully and follow it strictly.

A "good" keyword for this business is one a real prospect — someone in or near ${cityLabel} who would pay this business to perform their core service — would actually type into Google.

  9-10  Perfect: clear local commercial intent. Examples of patterns:
        - "{service} {city}" / "{service} near me"
        - "best {service} {city}" / "{service} agency {city}"
        - "{service} for {their target vertical}"
        - "hire {service}" / "{service} cost" / "{service} pricing"
  7-8   Strong: matches core service AND has commercial qualifier even if
        not local (e.g. "wordpress development services").
  5-6   Useful as supporting/blog content (top-of-funnel info that a real
        prospect might read) but won't directly drive leads on its own.
  3-4   Weak relevance — vaguely on-topic but the searcher is unlikely
        to be a paying prospect.
  1-2   Drop entirely. Use this for ALL of the following — no exceptions:
        - Searchers who want to LEARN the skill (course/tutorial/how-to-learn)
        - DIY searchers ("make your own", "do it yourself")
        - Job seekers (salary, jobs, intern, career)
        - Generic single-term industry words with no qualifier ("web design",
          "lawn care") — a small local business cannot realistically rank
          for these and they don't signal local commercial intent
        - Definitional queries ("what is X", "why does Y")
        - National brand/franchise names
        - Software / tool / template / book / pdf searches

BE STRICT. The client should never see a keyword that wouldn't pass the
"would my actual paying customer type this?" test. When in doubt, score lower.

For each keyword return:
  - index: the keyword's number above
  - score: 1-10 per the rubric
  - reason: one short sentence
  - group: one of "Local Money" (high-intent local), "Service Commercial",
    "Vertical-Specific", "Top-of-Funnel" (educational but useful for blog),
    "Long-Tail Opportunity", or "Brand/Authority"

Respond with ONLY a JSON array. No markdown, no prose, no code fences:
[{"index":1,"score":9,"reason":"Local hiring intent for a core service","group":"Local Money"}, ...]`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
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
      if (idx >= 0 && idx < toScore.length && s.score >= 5) {
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
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
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
