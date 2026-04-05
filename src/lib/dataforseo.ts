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

async function apiCall(
  endpoint: string,
  body: unknown,
  config: DataForSEOConfig
) {
  const res = await fetch(`${DATAFORSEO_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getAuth(config)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DataForSEO API error: ${res.status} ${res.statusText}`);
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
