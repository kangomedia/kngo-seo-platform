// CPC cache — DataForSEO Google Ads CPC values keyed by (query, locationCode).
//
// Used by the traffic-value calc in performance.ts. The flow is:
//   1. resolveCpcs(queries, locationCode) returns Map<query, cpc | null>
//   2. Hits the KeywordCpc table for fresh entries (within FRESH_DAYS)
//   3. Batches the misses to DataForSEO (Google Ads search_volume endpoint),
//      writes results to cache, and merges them into the result map
//   4. Calls are batched at ≤700 keywords per request (DataForSEO's per-task
//      limit is 1000 but we leave headroom for safety)
//
// Cost: ~$0.05 per 1000 keywords looked up. The cache means the same query
// only gets paid for once per ~30-day window across all clients.

import { prisma } from "@/lib/prisma";

const FRESH_DAYS = 30;
const BATCH_SIZE = 700;
const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";

interface CpcEntry {
  cpc: number | null;
  searchVolume: number | null;
  competition: number | null;
}

// Normalize the query string for cache lookups so the same intent doesn't
// produce duplicate rows. DataForSEO is case-insensitive but trim/lowercase
// guarantees we de-dup queries that arrive from different sources (GSC,
// keyword research, manual tracking).
function normalize(q: string): string {
  return q.trim().toLowerCase();
}

function freshThreshold(): Date {
  const d = new Date();
  d.setDate(d.getDate() - FRESH_DAYS);
  return d;
}

function getDataForSEOAuth(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD must be set");
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

interface DforSEOSearchVolumeRow {
  keyword?: string;
  cpc?: number | null;
  search_volume?: number | null;
  competition?: number | null;
  competition_index?: number | null;
}

async function fetchCpcsFromDataForSEO(
  queries: string[],
  locationCode: number
): Promise<Map<string, CpcEntry>> {
  const result = new Map<string, CpcEntry>();
  if (queries.length === 0) return result;

  // DataForSEO accepts up to 1000 keywords per task; chunk into batches.
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const body = [
      {
        keywords: batch,
        location_code: locationCode,
        language_code: "en",
      },
    ];

    let res: Response;
    try {
      res = await fetch(
        `${DATAFORSEO_BASE}/keywords_data/google_ads/search_volume/live`,
        {
          method: "POST",
          headers: {
            Authorization: getDataForSEOAuth(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
    } catch (err) {
      console.warn("[cpc-cache] DataForSEO fetch failed, skipping batch", err);
      continue;
    }
    if (!res.ok) {
      console.warn(
        `[cpc-cache] DataForSEO returned ${res.status}, skipping batch`
      );
      continue;
    }
    const data = await res.json();
    const tasks = (data?.tasks || []) as Array<{
      result?: DforSEOSearchVolumeRow[] | null;
    }>;
    for (const task of tasks) {
      for (const row of task.result || []) {
        if (!row.keyword) continue;
        result.set(normalize(row.keyword), {
          cpc: row.cpc ?? null,
          searchVolume: row.search_volume ?? null,
          competition: row.competition ?? row.competition_index ?? null,
        });
      }
    }
  }

  return result;
}

/**
 * Resolve CPCs for a set of queries at the given DataForSEO location.
 * Returns a Map keyed by the *normalized* (trimmed + lowercased) query,
 * with values that may be null if DataForSEO has no advertiser data.
 *
 * Caching is best-effort — DataForSEO failures are swallowed and the
 * returned map will simply be missing those keys.
 */
export async function resolveCpcs(
  queries: string[],
  locationCode = 2840
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (queries.length === 0) return out;

  const normalized = Array.from(
    new Set(queries.map(normalize).filter((q) => q.length > 0))
  );

  // 1. Hit the cache for fresh entries
  const fresh = await prisma.keywordCpc.findMany({
    where: {
      keyword: { in: normalized },
      locationCode,
      fetchedAt: { gte: freshThreshold() },
    },
  });
  const cached = new Set<string>();
  for (const row of fresh) {
    out.set(row.keyword, row.cpc);
    cached.add(row.keyword);
  }

  // 2. Misses go to DataForSEO
  const misses = normalized.filter((q) => !cached.has(q));
  if (misses.length === 0) return out;

  const fetched = await fetchCpcsFromDataForSEO(misses, locationCode);

  // 3. Persist what we got back. Use upsert for idempotency.
  // Note: DataForSEO sometimes returns no row for a query (no advertiser data).
  // We still want to cache that as a "null" so we don't keep re-asking.
  for (const q of misses) {
    const entry = fetched.get(q) || {
      cpc: null,
      searchVolume: null,
      competition: null,
    };
    out.set(q, entry.cpc);
    try {
      await prisma.keywordCpc.upsert({
        where: { keyword_locationCode: { keyword: q, locationCode } },
        create: {
          keyword: q,
          locationCode,
          cpc: entry.cpc,
          searchVolume: entry.searchVolume,
          competition: entry.competition,
        },
        update: {
          cpc: entry.cpc,
          searchVolume: entry.searchVolume,
          competition: entry.competition,
          fetchedAt: new Date(),
        },
      });
    } catch (err) {
      // Cache write failure shouldn't fail the request.
      console.warn("[cpc-cache] upsert failed for", q, err);
    }
  }

  return out;
}

/**
 * Convenience: derive a *weighted-average* CPC from a set of clicks-by-query.
 * Used as a fallback when an individual query has no CPC data — we lean on
 * the average of the queries that DO have CPC for the same client/period.
 */
export function weightedAverageCpc(
  rows: { query: string; clicks: number }[],
  cpcs: Map<string, number | null>
): number | null {
  let weightedSum = 0;
  let weight = 0;
  for (const r of rows) {
    const cpc = cpcs.get(normalize(r.query));
    if (cpc != null && cpc > 0) {
      weightedSum += cpc * r.clicks;
      weight += r.clicks;
    }
  }
  if (weight === 0) return null;
  return weightedSum / weight;
}
