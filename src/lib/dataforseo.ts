/**
 * DataForSEO API Client
 * Provides rank tracking, keyword research, and SERP data
 */

const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";

interface DataForSEOConfig {
  login: string;
  password: string;
}

function getAuth(config: DataForSEOConfig): string {
  return Buffer.from(`${config.login}:${config.password}`).toString("base64");
}

/**
 * Fetch with retry-on-transient-error: 429 (rate limit) and 5xx are retried
 * with exponential backoff + jitter. 4xx other than 429 fail fast (auth /
 * bad-request errors won't fix themselves).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        // Non-retryable client error — return so the caller can read the body.
        return res;
      }
      lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt < maxAttempts) {
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function apiCall(
  endpoint: string,
  body: unknown,
  config: DataForSEOConfig
) {
  const res = await fetchWithRetry(`${DATAFORSEO_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getAuth(config)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DataForSEO API error: ${res.status} ${res.statusText} ${text}`.trim());
  }

  return res.json();
}

// ─── SERP Rank Check ──────────────────────────────────

export interface RankCheckParams {
  keyword: string;
  locationCode?: number; // default: 2840 (US)
  languageCode?: string; // default: "en"
  device?: "desktop" | "mobile";
}

export async function checkRank(
  params: RankCheckParams,
  config: DataForSEOConfig
) {
  const body = [
    {
      keyword: params.keyword,
      location_code: params.locationCode || 2840,
      language_code: params.languageCode || "en",
      device: params.device || "desktop",
      depth: 100,
    },
  ];

  return apiCall("/serp/google/organic/live/regular", body, config);
}

// ─── Keyword Research ─────────────────────────────────

export interface KeywordResearchParams {
  keywords: string[];
  locationCode?: number;
  languageCode?: string;
}

export async function getKeywordData(
  params: KeywordResearchParams,
  config: DataForSEOConfig
) {
  const body = [
    {
      keywords: params.keywords,
      location_code: params.locationCode || 2840,
      language_code: params.languageCode || "en",
    },
  ];

  return apiCall("/keywords_data/google_ads/search_volume/live", body, config);
}

// ─── Keyword Suggestions ──────────────────────────────

export async function getKeywordSuggestions(
  seed: string,
  config: DataForSEOConfig,
  locationCode = 2840
) {
  const body = [
    {
      keyword: seed,
      location_code: locationCode,
      language_code: "en",
      include_seed_keyword: true,
      limit: 50,
    },
  ];

  return apiCall(
    "/dataforseo_labs/google/related_keywords/live",
    body,
    config
  );
}

// ─── Competitor Analysis ──────────────────────────────

export async function getCompetitorKeywords(
  domain: string,
  config: DataForSEOConfig,
  locationCode = 2840
) {
  const body = [
    {
      target: domain,
      location_code: locationCode,
      language_code: "en",
      limit: 100,
    },
  ];

  return apiCall(
    "/dataforseo_labs/google/domain_rank_overview/live",
    body,
    config
  );
}

export type { DataForSEOConfig };
