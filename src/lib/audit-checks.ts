/**
 * DataForSEO On-Page Check Classification
 * 
 * DataForSEO returns checks as key/value booleans, but the semantics are MIXED:
 * - Some checks use `true` to mean "the issue EXISTS" (e.g., `no_title: true` → title IS missing)
 * - Some checks use `true` to mean "the condition IS MET" (e.g., `is_https: true` → page IS on HTTPS, which is GOOD)
 * 
 * This module classifies checks so we correctly identify real failures vs. passing checks.
 */

/**
 * POSITIVE checks: when `true`, the check is PASSING (good).
 * These should NOT be shown as issues when their value is `true`.
 */
const POSITIVE_CHECKS = new Set([
  "is_https",
  "has_html_doctype",
  "has_meta_description",
  "has_micromarkup",
  "from_sitemap",
  "canonical",                               // page HAS a canonical tag
  "meta_charset_consistency",                 // charset is consistent
  "seo_friendly_url",
  "seo_friendly_url_characters_check",
  "seo_friendly_url_dynamic_check",
  "seo_friendly_url_keywords_check",
  "seo_friendly_url_relative_length_check",
]);

/**
 * Checks that should be IGNORED entirely (not shown as issues or passes).
 * These are either non-actionable, redundant, or not meaningful for most sites.
 */
const IGNORED_CHECKS = new Set([
  "is_www",              // Neither good nor bad — just a preference
  "small_page_size",     // Not necessarily an issue
  "has_meta_title",      // Refers to <meta name="title">, NOT <title>. Almost no sites use this — not actionable.
  "high_content_rate",   // Inverse of low_content_rate — redundant. Not an issue if false.
  "frame",              // Common due to YouTube/Google Maps embeds — not an SEO issue
  "no_image_title",     // Image `title` attribute is extremely minor — not worth flagging
  "is_http",            // Redundant with is_https positive check
  "high_character_count", // Not necessarily an issue — informational only
  "irrelevant_meta_keywords", // Meta keywords are deprecated — Google ignores them
]);

/**
 * Human-readable labels for all checks
 */
export const CHECK_LABELS: Record<string, string> = {
  // Negative checks (true = bad)
  no_title: "Missing title tag",
  no_description: "Missing meta description",
  no_h1_tag: "Missing H1 tag",
  no_favicon: "Missing favicon",
  no_doctype: "Missing DOCTYPE",
  no_content_encoding: "No content encoding (gzip)",
  no_encoding_meta_tag: "Missing encoding meta tag",
  no_image_alt: "Images without alt text",
  no_image_title: "Images without title",
  is_broken: "Broken page",
  is_redirect: "Page redirects",
  is_4xx_code: "4xx error status",
  is_5xx_code: "5xx error status",
  is_http: "Not using HTTPS",
  has_redirect_chain: "Redirect chain detected",
  has_meta_refresh_redirect: "Meta refresh redirect",
  has_links_to_redirects: "Has links to redirects",
  has_micromarkup_errors: "Schema markup errors",
  duplicate_title_tag: "Duplicate title tag",
  duplicate_description: "Duplicate meta description",
  duplicate_title: "Duplicate title",
  duplicate_meta_tags: "Duplicate meta tags",
  title_too_long: "Title too long (>60 chars)",
  title_too_short: "Title too short (<30 chars)",
  description_too_long: "Description too long (>160 chars)",
  description_too_short: "Description too short (<70 chars)",
  low_content_rate: "Low content ratio",
  low_readability_rate: "Low readability score",
  low_character_count: "Low character count",
  high_loading_time: "Slow page load",
  high_waiting_time: "High server response time",
  large_page_size: "Large page size",
  high_character_count: "High character count",
  irrelevant_description: "Irrelevant meta description",
  irrelevant_title: "Irrelevant title",
  irrelevant_meta_keywords: "Irrelevant meta keywords",
  is_orphan_page: "Orphan page (no internal links)",
  is_link_relation_conflict: "Link relation conflict",
  recursive_canonical: "Recursive canonical",
  canonical_chain: "Canonical chain",
  canonical_to_redirect: "Canonical points to redirect",
  canonical_to_broken: "Canonical points to broken page",
  has_render_blocking_resources: "Render-blocking resources",
  https_to_http_links: "HTTPS page links to HTTP",
  size_greater_than_3mb: "Page size exceeds 3MB",
  deprecated_html_tags: "Deprecated HTML tags",
  flash: "Flash content detected",
  lorem_ipsum: "Lorem ipsum placeholder text",
  frame: "Frames/iframes detected",
  missing_title_tag: "Missing title tag",
  missing_meta_description: "Missing meta description",
  redirect_chain: "Redirect chain",
  // Positive checks (true = good, labels for "passed" display)
  is_https: "Served over HTTPS",
  has_html_doctype: "Has HTML doctype",
  has_meta_title: "Has meta title",
  has_meta_description: "Has meta description",
  has_micromarkup: "Has structured data",
  from_sitemap: "Found in sitemap",
  high_content_rate: "Good content ratio",
  canonical: "Has canonical tag",
  meta_charset_consistency: "Charset is consistent",
  seo_friendly_url: "SEO-friendly URL",
  seo_friendly_url_characters_check: "URL characters check passed",
  seo_friendly_url_dynamic_check: "URL is not dynamic",
  seo_friendly_url_keywords_check: "URL contains keywords",
  seo_friendly_url_relative_length_check: "URL length is acceptable",
};

/**
 * Given a checks object from DataForSEO, returns only the genuinely FAILED checks.
 * 
 * Logic:
 * - For POSITIVE checks (e.g., `is_https`): value `false` = failure, value `true` = pass
 * - For NEGATIVE checks (e.g., `no_title`): value `true` = failure, value `false` = pass
 * - IGNORED checks are never returned as failures
 */
export function getRealFailedChecks(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([key, value]) => {
      if (IGNORED_CHECKS.has(key)) return false;
      if (POSITIVE_CHECKS.has(key)) return !value;  // Positive check: false = failure
      return value;                                   // Negative check: true = failure
    })
    .map(([key]) => key);
}

/**
 * Given a checks object from DataForSEO, returns only the genuinely PASSED checks.
 */
export function getRealPassedChecks(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([key, value]) => {
      if (IGNORED_CHECKS.has(key)) return false;
      if (POSITIVE_CHECKS.has(key)) return value;   // Positive check: true = pass
      return !value;                                  // Negative check: false = pass
    })
    .map(([key]) => key);
}

/**
 * Filter a checks object to only include genuinely failed checks.
 * This is used before sending data to Claude for recommendations.
 */
export function filterToRealFailures(checks: Record<string, boolean>): Record<string, boolean> {
  const failedKeys = new Set(getRealFailedChecks(checks));
  const filtered: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(checks)) {
    if (failedKeys.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Get a human-readable label for a check key.
 */
export function getCheckLabel(key: string): string {
  return CHECK_LABELS[key] || key.replace(/_/g, " ");
}
