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

/**
 * A service page crawled from the client's site. Used as a "pillar" anchor:
 * each pillar gets its own set of supporting-content keywords that the AI
 * pipeline can later turn into a topic cluster.
 */
export interface ServicePage {
  url: string;
  title: string | null;
  description: string | null;
  /** Derived: the last meaningful path segment (e.g. "kitchen-remodeling"). */
  slug: string;
}

/**
 * A seed phrase + its provenance — which pillar (if any) it was generated
 * against. Keywords expanded from a pillar-tagged seed inherit the pillar
 * so the dashboard can render content clusters per service page.
 */
export interface SeedWithPillar {
  seed: string;
  pillarUrl: string | null;
  pillarTitle: string | null;
}

export interface BusinessProfile {
  businessDescription: string | null;
  primaryServices: string[];
  idealClientProfile: string | null;
  priceRange: string | null;
  industryVertical: string | null;
  industrySector: string | null;
  serviceAreas: string[];
  targetCities: string[];
  /** Optional branded query terms — used to filter out branded keywords from
   *  research and to remind the AI seed prompt not to propose branded seeds. */
  brandTerms?: string[];
  /** Service pages crawled from the audit. When present, seed generation
   *  produces pillar-tagged seeds so each service page gets its own cluster
   *  of supporting-content keywords. */
  servicePages?: ServicePage[];
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
  /** Pillar provenance — which service page this keyword supports. Null for
   *  general/business-wide keywords not tied to a specific service. */
  pillarUrl?: string | null;
  pillarTitle?: string | null;
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

// ─── Brand Term Filter ───────────────────────────────────

/**
 * Filter out keywords that contain any of the client's brand terms.
 * Brand keywords clog research output — the client already ranks for their
 * own name, and we want non-branded opportunity keywords.
 */
export function filterByBrandTerms(
  keywords: RawKeyword[],
  brandTerms: string[],
): RawKeyword[] {
  const terms = brandTerms.map((t) => t.toLowerCase().trim()).filter(Boolean);
  if (terms.length === 0) return keywords;
  return keywords.filter((kw) => {
    const k = kw.keyword.toLowerCase();
    return !terms.some((t) => k.includes(t));
  });
}

// ─── Near-Duplicate Dedup ────────────────────────────────

/**
 * Collapse near-duplicate keywords that differ only by word order, stop words,
 * or minor punctuation/state-suffix variation. Keeps the variant with the
 * highest search volume.
 *
 * Examples that get collapsed:
 *   "kitchen remodeling denver co" / "kitchen remodeling in denver co"
 *   "basement finishing denver" / "denver basement finishing"
 *   "design-build vs general contractor" / "general contractor vs design build"
 */
const NEAR_DUP_STOP = new Set([
  "the", "a", "an", "in", "for", "of", "to", "with", "and", "or", "on", "at",
  "by", "is", "are", "co", "vs", "near",
]);

function nearDupKey(keyword: string): string {
  const tokens = keyword
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !NEAR_DUP_STOP.has(w));
  return [...tokens].sort().join(" ");
}

export function dedupNearDuplicates(keywords: RawKeyword[]): RawKeyword[] {
  const byKey = new Map<string, RawKeyword>();
  for (const kw of keywords) {
    const key = nearDupKey(kw.keyword);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || kw.searchVolume > existing.searchVolume) {
      byKey.set(key, kw);
    }
  }
  return Array.from(byKey.values());
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

    // Keep informational with any meaningful CPC — these are supporting-content
    // (blog) keywords that drive traffic to pillars. Threshold lowered from $10
    // to $1 so we don't shred TOFU/MOFU candidates.
    if (intent === "informational" && kw.cpc >= 1) return true;

    // Drop navigational entirely
    if (intent === "navigational") return false;

    // If DataForSEO didn't return intent metadata, lean on CPC as a soft
    // commercial-intent proxy. Threshold dropped from $3 to $1 so long-tail
    // candidates don't get nuked by missing-intent + low-CPC.
    if (!intent || intent === "undefined") {
      return kw.cpc >= 1;
    }

    return false;
  });
}

// ─── Service Page Identification ─────────────────────────

const NON_SERVICE_URL_PATTERNS = [
  /\/blog(\/|$)/i,
  /\/post[s]?(\/|$)/i,
  /\/article[s]?(\/|$)/i,
  /\/news(\/|$)/i,
  /\/tag[s]?(\/|$)/i,
  /\/category(\/|$)/i,
  /\/author(\/|$)/i,
  /\/page\/\d+/i,
  /\/contact(\/|$)/i,
  /\/about(\/|$)/i,
  /\/privacy(\/|$)/i,
  /\/terms(\/|$)/i,
  /\/sitemap/i,
  /\/wp-/i,
  /\.(pdf|jpg|jpeg|png|gif|css|js)$/i,
];

const SERVICE_URL_HINTS = [
  /\/services?\//i,
  /\/what-we-do\//i,
  /\/our-services?\//i,
  /\/offerings\//i,
  /\/solutions?\//i,
];

function slugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "home";
  } catch {
    return url;
  }
}

/**
 * Identify the subset of crawled pages that look like SERVICE pages —
 * the pillars worth generating supporting-content keyword clusters for.
 *
 * Heuristics:
 *   - Excludes blog/post/tag/category/utility URLs
 *   - Excludes pages with 0/100+ word count (likely empty or list pages)
 *   - Prioritizes URLs under /services/, /solutions/, etc.
 *   - Prioritizes URLs whose slug or title contains a primary-service term
 */
export function identifyServicePages(
  pages: Array<{
    url: string;
    title: string | null;
    description: string | null;
    wordCount?: number;
  }>,
  primaryServices: string[],
  domain: string,
): ServicePage[] {
  const serviceTerms = primaryServices
    .flatMap((s) => s.toLowerCase().split(/[\s,&/]+/))
    .filter((w) => w.length > 3);

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const candidates = pages
    .filter((p) => p.url && p.url.includes(cleanDomain))
    .filter((p) => !NON_SERVICE_URL_PATTERNS.some((rx) => rx.test(p.url)))
    // Skip the home page — it's not a service pillar even though it ranks high
    .filter((p) => {
      try {
        const u = new URL(p.url);
        return u.pathname !== "/" && u.pathname !== "";
      } catch {
        return true;
      }
    })
    .filter((p) => !p.wordCount || p.wordCount >= 100);

  const scored = candidates.map((p) => {
    const slug = slugFromUrl(p.url);
    const haystack = `${slug} ${p.title || ""} ${p.description || ""}`.toLowerCase();
    let score = 0;
    if (SERVICE_URL_HINTS.some((rx) => rx.test(p.url))) score += 3;
    for (const term of serviceTerms) {
      if (haystack.includes(term)) score += 2;
    }
    if (p.title && p.title.length > 5) score += 1;
    return { page: p, slug, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10) // cap at 10 pillars — more than that and the AI prompt bloats
    .map((x) => ({
      url: x.page.url,
      title: x.page.title,
      description: x.page.description,
      slug: x.slug,
    }));
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
 * Ask Claude to propose seed phrases tailored to the business profile.
 *
 * When `profile.servicePages` is populated, seeds are generated PER PILLAR:
 * each service page gets its own dedicated seeds for supporting-content
 * keywords, plus a smaller pool of business-wide general seeds. This means
 * each keyword can be traced back to a specific service page, so the
 * dashboard can render content clusters per pillar.
 *
 * When no service pages are available (audit didn't surface any, or it
 * failed), seeds are flat and untagged — same as the original behavior.
 *
 * Falls back to `generateSmartSeeds` (mechanical) if the AI request fails.
 */
export async function generateAISeeds(
  profile: BusinessProfile,
  anthropicKey: string,
): Promise<SeedWithPillar[]> {
  const allCities = profile.targetCities.filter(Boolean);
  const primaryCity = allCities[0] || "(no city specified)";
  const cityList = allCities.length > 0 ? allCities.join(", ") : "(no cities specified)";
  const brandTerms = (profile.brandTerms || []).filter(Boolean);
  const servicePages = (profile.servicePages || []).slice(0, 8);
  const hasPillars = servicePages.length > 0;

  const profileLines = [
    `Business: ${profile.clientName}`,
    profile.businessDescription ? `What they do: ${profile.businessDescription}` : null,
    profile.primaryServices.length > 0 ? `Services: ${profile.primaryServices.join(", ")}` : null,
    profile.idealClientProfile ? `Ideal customer: ${profile.idealClientProfile}` : null,
    profile.industrySector ? `Industry sector: ${profile.industrySector}` : null,
    profile.industryVertical ? `Industry vertical: ${profile.industryVertical}` : null,
    profile.serviceAreas.length > 0 ? `Service areas: ${profile.serviceAreas.join(", ")}` : null,
    `Target cities (cover the full list, not just the first): ${cityList}`,
    brandTerms.length > 0 ? `Brand terms to AVOID in seeds: ${brandTerms.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const pillarSection = hasPillars
    ? `\nSERVICE PAGES (PILLARS) — these are real pages on the site. For each one, generate dedicated seeds that will surface SUPPORTING-CONTENT keywords (blog posts that link back to this pillar):
${servicePages.map((p, i) => `  ${i + 1}. ${p.title || p.slug} — ${p.url}${p.description ? `\n     Description: ${p.description.slice(0, 200)}` : ""}`).join("\n")}\n`
    : "";

  const prompt = hasPillars
    ? `You are an SEO strategist building a CONTENT CLUSTER strategy for a LOCAL SERVICE BUSINESS. Each service page is a pillar; your job is to generate seeds that produce SUPPORTING-CONTENT KEYWORDS for each pillar — keywords for blog posts that link back to the pillar and drive traffic to it.

BUSINESS PROFILE:
${profileLines}
${pillarSection}

For EACH pillar above, generate 4–6 seed phrases. Pillar seeds should target keywords that a real prospect researches before they're ready to hire — problem-aware, comparison, cost, location-qualified, decision-stage phrases. Examples for a "Kitchen Remodeling" pillar:
  - "kitchen remodel cost ${primaryCity}"
  - "how long does a kitchen remodel take"
  - "kitchen remodel mistakes to avoid"
  - "best kitchen layout for resale"
  - "kitchen remodel timeline"

Also generate 6–10 GENERAL seeds for business-wide local/commercial intent (not tied to a single pillar):
  - Local money phrases spread across the target cities: ${cityList}
  - Service commercial ("hire {service} {city}", "{service} company")
  - ICP-specific niches the profile explicitly mentions

Rules — do not break these:
  - Each seed must look like something a paying customer would actually type
  - DO NOT include educational ("course", "tutorial", "how to learn"), DIY, or job-seeker phrases
  - DO NOT include single-word generic terms unless paired with a qualifier
  - DO NOT include the business's brand terms${brandTerms.length > 0 ? ` (listed above)` : ""}
  - Lowercase, trimmed, no punctuation other than spaces
  - A pillar's seeds should be obviously tied to that pillar's topic

Respond with ONLY a JSON object in this shape — no prose, no markdown, no code fences:
{
  "perPillar": [
    { "pillarUrl": "url-from-above", "seeds": ["seed1", "seed2", ...] },
    ...
  ],
  "general": ["seed1", "seed2", ...]
}`
    : `You are an SEO strategist preparing seed keywords for a LOCAL SERVICE BUSINESS. The business serves multiple distinct geographic markets — generate seeds that cover the FULL list of target cities, not only the first one.

BUSINESS PROFILE:
${profileLines}

Produce 20 seed phrases. Mix:
  - 6–8 LOCAL MONEY phrases — spread across the target cities (don't anchor all to ${primaryCity})
  - 3–5 SERVICE COMMERCIAL phrases ("{service} cost", "hire {service}")
  - 3–5 VERTICAL- or ICP-SPECIFIC phrases tied to the unique customer
  - 2–4 TOP-OF-FUNNEL problem-aware phrases

Rules:
  - Each seed must look like something a paying customer would actually type
  - DO NOT include educational, DIY, or job-seeker phrases
  - DO NOT include single-word generic terms unless paired with a qualifier
  - DO NOT include the business's brand terms${brandTerms.length > 0 ? ` (listed above)` : ""}
  - Lowercase, trimmed, no punctuation other than spaces

Respond with ONLY a JSON object — no prose, no markdown, no code fences:
{ "general": ["seed1", "seed2", ...] }`;

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
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
    const data = await res.json();
    const text = (data?.content?.[0]?.text || "").trim();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const out: SeedWithPillar[] = [];
    const seenSeeds = new Set<string>();
    const pushSeed = (raw: unknown, pillarUrl: string | null, pillarTitle: string | null) => {
      if (typeof raw !== "string") return;
      const s = raw.toLowerCase().trim();
      if (!s || seenSeeds.has(s)) return;
      seenSeeds.add(s);
      out.push({ seed: s, pillarUrl, pillarTitle });
    };

    if (Array.isArray(parsed?.perPillar)) {
      for (const group of parsed.perPillar) {
        const pillar = servicePages.find((p) => p.url === group?.pillarUrl);
        const pillarUrl = pillar?.url ?? null;
        const pillarTitle = pillar?.title ?? pillar?.slug ?? null;
        if (Array.isArray(group?.seeds)) {
          for (const s of group.seeds) pushSeed(s, pillarUrl, pillarTitle);
        }
      }
    }
    if (Array.isArray(parsed?.general)) {
      for (const s of parsed.general) pushSeed(s, null, null);
    }

    if (out.length === 0) throw new Error("Empty seed list");
    return out;
  } catch (err) {
    console.warn("[KW-INTEL] generateAISeeds fell back to mechanical seeds:", err instanceof Error ? err.message : err);
    return generateSmartSeeds(profile).map((seed) => ({ seed, pillarUrl: null, pillarTitle: null }));
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
    profile.industrySector ? `Industry sector: ${profile.industrySector}` : null,
    profile.industryVertical ? `Industry vertical: ${profile.industryVertical}` : null,
    painLines.length > 0 ? `ICP pain points (verbatim from the agency):\n  - ${painLines.join("\n  - ")}` : null,
  ].filter(Boolean).join("\n");

  const sectorLabel = profile.industrySector || profile.industryVertical || null;
  const verticalNudge = sectorLabel
    ? `\nIMPORTANT: This business operates in **${profile.industryVertical || sectorLabel}**${profile.industrySector ? ` (sector: ${profile.industrySector})` : ""}. Generate seeds in the language THIS vertical's customers use — not generic SaaS or service-business automation phrases. A customer's vocabulary in this industry is specific (e.g. an HVAC homeowner doesn't search the same terms as a personal-injury claimant).`
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
    // Fall back to user-supplied pains as seeds — but DataForSEO rejects any
    // "keyword" longer than ~80 chars (40501 "Keyword text exceeds the allowed
    // limit"). User-typed pain strings are full sentences ("getting burned
    // by a previous contractor — ghosting, blown budgets…"), so we extract
    // the first 2–5 meaningful words from each pain instead of sending the
    // sentence verbatim. Imperfect, but safer than 40501s on every call.
    return painLines
      .map((p) => {
        const cleaned = p
          .toLowerCase()
          .replace(/[—–-]/g, " ")
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .replace(/\s+/g, " ")
          .trim();
        return cleaned.split(" ").slice(0, 5).join(" ");
      })
      .filter((s) => s.length > 0 && s.length <= 80)
      .slice(0, 12);
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
    profile.industrySector ? `Industry Sector: ${profile.industrySector}` : null,
    profile.industryVertical ? `Industry Vertical: ${profile.industryVertical}` : null,
    profile.serviceAreas.length > 0 ? `Service Areas: ${profile.serviceAreas.join(", ")}` : null,
    profile.targetCities.length > 0 ? `Target Cities: ${profile.targetCities.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  // Pick the 150 most LOCALLY + COMMERCIALLY promising keywords. Bias
  // selection toward geo-anchored, buying-intent terms before AI scoring.
  // Bumped from 100 → 150 so the scorer has more material to work with after
  // earlier filters do their pruning.
  const toScore = keywords
    .map((kw) => ({ kw, s: preRelevanceScore(kw, profile) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 150)
    .map((x) => x.kw);

  const kwList = toScore.map((kw, i) =>
    `${i + 1}. "${kw.keyword}" — Vol: ${kw.searchVolume}, CPC: $${kw.cpc.toFixed(2)}, Competition: ${kw.competition}%, Intent: ${kw.intent || "unknown"}${kw.pillarTitle ? `, Pillar: ${kw.pillarTitle}` : ""}`
  ).join("\n");

  const prompt = `You are an SEO strategist scoring keywords for a LOCAL SERVICE BUSINESS that wants to attract paying clients in ${cityLabel} through a CONTENT CLUSTER strategy: pillar service pages + supporting blog content that links into them. So you're scoring both DIRECT-INTENT keywords (likely to convert) AND SUPPORTING-CONTENT keywords (drive traffic to a pillar via a blog post). Both have value.

BUSINESS PROFILE:
${businessContext}

KEYWORDS TO EVALUATE:
${kwList}

────────────────────────────────────────────────────────
SCORING RUBRIC — read carefully and follow it strictly.

  9-10  Perfect: clear local commercial intent. Examples:
        - "{service} {city}" / "{service} near me"
        - "best {service} {city}" / "hire {service}"
        - "{service} cost {city}" / "{service} pricing"
  7-8   Strong: matches core service AND has commercial qualifier even if
        not local (e.g. "kitchen remodeling services", "adu builder").
  5-6   Solid SUPPORTING-CONTENT topic — a blog post targeting this keyword
        would attract real prospects researching the service ("kitchen
        remodel cost", "how long does a basement remodel take", "{service}
        ideas {year}", "{service} mistakes to avoid"). Keep these — they
        feed the content cluster strategy.
  3-4   Weak but plausible content angle. Might still be worth a blog post
        if the volume is meaningful. Default for ambiguous keywords.
  1-2   Drop entirely. Use ONLY for the following — no exceptions:
        - Searchers who want to LEARN THE TRADE (course/tutorial/certification/
          "how to become a {trade}")
        - DIY searchers explicitly looking to do the work themselves
          ("DIY {service}", "do it yourself {service}")
        - Job seekers (salary, "jobs near me", intern, career, hiring)
        - Definitional queries with zero buying signal ("what is a contractor")
        - National brand/franchise names the business doesn't compete with
        - Software / tool / template / book / pdf searches when the business
          is NOT in software

DO NOT auto-drop "generic" industry terms ("kitchen remodeling", "bathroom
remodel"). Score them based on whether they could anchor a pillar page or
supporting blog — generic but on-topic terms can still earn local traffic
when ranked alongside a content cluster. They typically score 4-6.

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

    // Map scores back to keywords. Threshold lowered from 5 → 3 so supporting-
    // content keywords (blog topics that drive traffic to pillars) aren't
    // dropped. The dashboard shows the score, so weak matches stay visible
    // and the operator can decide.
    const scored: ScoredKeyword[] = [];
    for (const s of scores) {
      const idx = s.index - 1;
      if (idx >= 0 && idx < toScore.length && s.score >= 3) {
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
    profile.industrySector ? `Industry Sector: ${profile.industrySector}` : null,
    profile.industryVertical ? `Industry Vertical: ${profile.industryVertical}` : null,
    profile.serviceAreas.length > 0 ? `Service Areas: ${profile.serviceAreas.join(", ")}` : null,
    profile.targetCities.length > 0 ? `Target Cities: ${profile.targetCities.join(", ")}` : null,
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

  const prompt = `You are an SEO strategist preparing a keyword research summary for a client. This is shown on the client's own dashboard — write to the business owner directly.

BUSINESS PROFILE:
${businessContext}

KEYWORD GROUPS FOUND: ${groupSummary}

TOP KEYWORDS (sorted by relevance × search volume):
${kwSummary}

Write a strategic analysis with these sections, in this order, using markdown headings:

## Top Priority Keywords
Which 5–8 keywords matter most and why.

## Quick Wins
Keywords they can likely rank for fast.

## Content Strategy
Blog topics and landing pages they should create.

## Local SEO
Location-specific opportunities, if any.

## Next Steps
Concrete actions for the first 30 days.

FORMAT RULES (important — the renderer is simple):
- Use level-2 markdown headings (## Section Name) for each section above. Do NOT use a level-1 (# ) heading for the document title.
- Keep paragraphs SHORT — 2–4 sentences max. If a thought runs longer, break it into two paragraphs.
- Prefer bullet lists when listing keywords, opportunities, or action items. Use "- " for bullets.
- Use **bold** sparingly to highlight the most important phrase per paragraph.
- Do not use any of these terms: TOFU, MOFU, BOFU, "topical authority", "keyword clusters" (use "groups of related keywords" instead), SERP, "search intent" (use "what the searcher is trying to do" instead), GBP (spell out "Google Business Profile").
- Mention actual keywords in quotes ("like this").
- Write like a confident strategist talking to a business owner over coffee — no buzzwords, no fluff.`;

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
