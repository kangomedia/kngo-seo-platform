/**
 * Typed parsers for the JSON-as-text columns on the Prisma schema.
 *
 * Background: 16 columns on the `Client` model (plus a handful elsewhere)
 * store JSON-encoded strings — a legacy shape from before we had Zod. Every
 * consumer used to do `try { JSON.parse(raw || "[]") } catch { return [] }`
 * inline, leading to 57 copy-pasted parse sites whose drift is the #1 source
 * of "fix one thing, break another" bugs.
 *
 * One parser per column. Each one:
 *   - Validates with a Zod schema (the contract for what that column holds).
 *   - Returns the validated shape OR a safe default.
 *   - Logs a `console.warn` on parse/validation failure so legacy/corrupt
 *     rows are findable without crashing the request.
 *
 * Long-term: columns that should be relations (`competitors`) move to
 * structured tables and these parsers get deleted. Columns that should stay
 * JSON (`results`, `mapData`, `socialPosts`) get their schema enriched here
 * as the contract evolves.
 */

import { z } from "zod";

// ─── Shared shapes ───────────────────────────────────────────

/**
 * The five Client string-array columns (serviceAreas, targetCities,
 * brandTerms, primaryServices, icpPains) all share this contract.
 * They're separate exports below so each column has a single source of truth
 * we can specialize later if (e.g.) brandTerms grows an `isExclude` flag.
 */
const StringArraySchema = z.array(z.string().trim().min(1)).default([]);

// ─── Per-column parsers ──────────────────────────────────────

/**
 * Parse `Client.serviceAreas` — geographic regions ("Denver Metro",
 * "Colorado Mountain Corridor"). Distinct from `primaryServices`.
 */
export function parseClientServiceAreas(raw: string | null | undefined): string[] {
  return parseStringArrayColumn(raw, "Client.serviceAreas");
}

/**
 * Parse `Client.targetCities` — specific cities to rank in ("Denver, CO").
 */
export function parseClientTargetCities(raw: string | null | undefined): string[] {
  return parseStringArrayColumn(raw, "Client.targetCities");
}

/**
 * Parse `Client.brandTerms` — branded query terms to filter out of keyword
 * research. If empty/missing, the discovery pipeline derives terms from
 * name + domain automatically.
 */
export function parseClientBrandTerms(raw: string | null | undefined): string[] {
  return parseStringArrayColumn(raw, "Client.brandTerms");
}

/**
 * Parse `Client.primaryServices` — the services the business actually sells
 * ("kitchen remodeling", "ADU construction"). Distinct from `serviceAreas`.
 */
export function parseClientPrimaryServices(raw: string | null | undefined): string[] {
  return parseStringArrayColumn(raw, "Client.primaryServices");
}

/**
 * Parse `Client.icpPains` — the ICP's pain points (drives pain-point
 * keyword research). Free-text strings.
 */
export function parseClientIcpPains(raw: string | null | undefined): string[] {
  return parseStringArrayColumn(raw, "Client.icpPains");
}

/**
 * Parse `Client.competitors` — DEPRECATED. The structured `Competitor` table
 * is the source of truth; this column is kept for backward-compat reads
 * until the table migration is finished and this column is dropped.
 */
export function parseClientCompetitorsLegacy(raw: string | null | undefined): string[] {
  return parseStringArrayColumn(raw, "Client.competitors (legacy)");
}

// ─── KeywordResearch.results ─────────────────────────────────

/**
 * The validated shape of a single keyword inside `KeywordResearch.results`.
 * Permissive on optional fields so legacy rows (written before the
 * pillar-tagging and AI-scoring fields existed) still parse cleanly — only
 * the core text + metrics are required.
 *
 * Unknown fields pass through (`.passthrough()`) so newer fields written by
 * the discovery pipeline survive parser-roundtrip even if the schema here
 * lags slightly behind. Consumers reading those newer fields keep working.
 */
const KeywordResearchResultSchema = z
  .object({
    keyword: z.string().min(1),
    searchVolume: z.number().int().nonnegative(),
    competition: z.number().int().nonnegative().optional().default(0),
    cpc: z.number().nonnegative().optional().default(0),
    source: z.string().optional().default("unknown"),
    intent: z.string().nullable().optional(),
    relevanceScore: z.number().optional().default(5),
    relevanceReason: z.string().optional().default(""),
    suggestedGroup: z.string().optional().default("General"),
    pillarUrl: z.string().nullable().optional(),
    pillarTitle: z.string().nullable().optional(),
  })
  .passthrough();

/** Public type for consumers (the dashboard table, report generator, etc.). */
export type KeywordResearchResult = z.infer<typeof KeywordResearchResultSchema>;

/**
 * Parse `KeywordResearch.results` — JSON array of keyword objects produced
 * by the discovery / research pipelines. Each entry is independently
 * validated; malformed entries are dropped with a logged count so one bad
 * entry doesn't nuke the entire research session. (A 60-keyword session
 * with 2 corrupt rows should still render 58 keywords, not 0.)
 */
export function parseKeywordResearchResults(
  raw: string | null | undefined,
): KeywordResearchResult[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[parsers] KeywordResearch.results: malformed JSON, returning []");
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.warn(
      "[parsers] KeywordResearch.results: top-level value is not an array, returning []",
    );
    return [];
  }

  const valid: KeywordResearchResult[] = [];
  let droppedCount = 0;
  let firstDropReason: string | null = null;

  for (const entry of parsed) {
    const result = KeywordResearchResultSchema.safeParse(entry);
    if (result.success) {
      valid.push(result.data);
    } else {
      droppedCount++;
      if (firstDropReason === null) {
        firstDropReason = result.error.issues[0]?.message ?? "unknown";
      }
    }
  }

  if (droppedCount > 0) {
    console.warn(
      `[parsers] KeywordResearch.results: dropped ${droppedCount}/${parsed.length} malformed entries. First reason: ${firstDropReason}`,
    );
  }

  return valid;
}

// ─── SiteAuditPage.checks ────────────────────────────────────

/**
 * `SiteAuditPage.checks` is DataForSEO's per-page checks blob — a flat map
 * of `check_key → result`. Most results are booleans (true = passed, false =
 * failed) but a handful are objects/numbers depending on the check.
 *
 * The downstream helpers in `lib/audit-checks.ts` (getRealFailedChecks,
 * filterToRealFailures, getReportFailedChecks) treat values truthily and
 * declare their input as `Record<string, boolean>`. We coerce values to
 * boolean at the parse boundary so consumers can keep their existing
 * signatures — same truthy semantics as before, just type-honest.
 */
const SiteAuditPageChecksSchema = z.record(
  z.string(),
  z.unknown().transform((v) => Boolean(v)),
);

export type SiteAuditPageChecks = z.infer<typeof SiteAuditPageChecksSchema>;

export function parseSiteAuditPageChecks(
  raw: string | null | undefined,
): SiteAuditPageChecks {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[parsers] SiteAuditPage.checks: malformed JSON, returning {}");
    return {};
  }
  const result = SiteAuditPageChecksSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[parsers] SiteAuditPage.checks: shape mismatch, returning {}. First issue: ${result.error.issues[0]?.message ?? "unknown"}`,
    );
    return {};
  }
  return result.data;
}

// ─── SiteAuditPage.recommendations ───────────────────────────

/**
 * `SiteAuditPage.recommendations` is the AI-generated rec list produced by
 * `generateSEORecommendations()`. Shape is intentionally permissive — the
 * generator's output schema has evolved (e.g. `recommendation` → `suggestion`
 * field rename) so consumers handle both naming. We validate "array of
 * objects" and let consumers narrow.
 */
const SiteAuditPageRecommendationsSchema = z.array(
  z.object({}).passthrough(),
);

export type SiteAuditPageRecommendation = z.infer<typeof SiteAuditPageRecommendationsSchema>[number];

export function parseSiteAuditPageRecommendations(
  raw: string | null | undefined,
): SiteAuditPageRecommendation[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[parsers] SiteAuditPage.recommendations: malformed JSON, returning []");
    return [];
  }
  const result = SiteAuditPageRecommendationsSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[parsers] SiteAuditPage.recommendations: shape mismatch, returning []. First issue: ${result.error.issues[0]?.message ?? "unknown"}`,
    );
    return [];
  }
  return result.data;
}

// ─── MonthlySnapshot.pageData ────────────────────────────────

/**
 * `MonthlySnapshot.pageData` is an array of per-page traffic summaries from
 * GSC. Required fields: `url`, `clicks`, `impressions` — the report
 * aggregation depends on these. Optional `title` survives via passthrough.
 *
 * Per-entry validation drops malformed rows individually (same pattern as
 * `parseKeywordResearchResults`) so one bad page entry doesn't nuke an
 * entire month of analytics.
 */
const MonthlySnapshotPageDataEntrySchema = z
  .object({
    url: z.string().min(1),
    clicks: z.number().int().nonnegative(),
    impressions: z.number().int().nonnegative(),
  })
  .passthrough();

export type MonthlySnapshotPage = z.infer<typeof MonthlySnapshotPageDataEntrySchema>;

export function parseMonthlySnapshotPageData(
  raw: string | null | undefined,
): MonthlySnapshotPage[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[parsers] MonthlySnapshot.pageData: malformed JSON, returning []");
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.warn("[parsers] MonthlySnapshot.pageData: top-level value is not an array, returning []");
    return [];
  }
  const valid: MonthlySnapshotPage[] = [];
  let droppedCount = 0;
  let firstDropReason: string | null = null;
  for (const entry of parsed) {
    const result = MonthlySnapshotPageDataEntrySchema.safeParse(entry);
    if (result.success) {
      valid.push(result.data);
    } else {
      droppedCount++;
      if (firstDropReason === null) {
        firstDropReason = result.error.issues[0]?.message ?? "unknown";
      }
    }
  }
  if (droppedCount > 0) {
    console.warn(
      `[parsers] MonthlySnapshot.pageData: dropped ${droppedCount}/${parsed.length} malformed entries. First reason: ${firstDropReason}`,
    );
  }
  return valid;
}

// ─── ContentMap.mapData ──────────────────────────────────────

/**
 * Minimal shape contract for the content-strategy `mapData` blob.
 *
 * The full shape (pillars with nested pieces, quickWins, monthly schedule,
 * funnel stages, etc.) is defined by the Claude prompt in
 * `/api/clients/[clientId]/content-map/route.ts`. We intentionally validate
 * ONLY the top-level structure here:
 *   - mapData must be a plain object
 *   - if present, `pillars` and `quickWins` must be arrays
 *
 * Everything inside the arrays passes through unchanged (`.passthrough()`),
 * so consumers reading `mapData.pillars[0].pieces[0].title` still get the
 * data even if individual piece fields evolve faster than this schema.
 *
 * This deliberately bends the "fully type the column" recommendation in the
 * audit — the piece-level shape is large and still moving, so locking it in
 * a parser right now would cause more drift-firefighting than it prevents.
 * Tighten over time as the shape stabilizes.
 */
const ContentMapDataSchema = z
  .object({
    pillars: z.array(z.unknown()).optional().default([]),
    quickWins: z.array(z.unknown()).optional().default([]),
  })
  .passthrough();

export type ContentMapData = z.infer<typeof ContentMapDataSchema>;

/**
 * Parse `ContentMap.mapData` — the JSON-serialized content strategy produced
 * by the AI. Returns an empty `{ pillars: [], quickWins: [] }` skeleton on
 * malformed input so the dashboard renders an empty state instead of crashing.
 */
export function parseContentMapData(raw: string | null | undefined): ContentMapData {
  const empty: ContentMapData = { pillars: [], quickWins: [] };
  if (!raw) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[parsers] ContentMap.mapData: malformed JSON, returning empty skeleton");
    return empty;
  }

  const result = ContentMapDataSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[parsers] ContentMap.mapData: shape mismatch, returning empty skeleton. First issue: ${result.error.issues[0]?.message ?? "unknown"}`,
    );
    return empty;
  }
  return result.data;
}

// ─── Internals ───────────────────────────────────────────────

function parseStringArrayColumn(raw: string | null | undefined, columnLabel: string): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[parsers] ${columnLabel}: malformed JSON, returning []`);
    return [];
  }
  const result = StringArraySchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[parsers] ${columnLabel}: shape mismatch, returning []. First issue: ${result.error.issues[0]?.message ?? "unknown"}`,
    );
    return [];
  }
  return result.data;
}
