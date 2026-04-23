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
 * Checks excluded from CLIENT-FACING REPORTS.
 * These are either too noisy, unreliable across crawls, or confusing for clients.
 * They still appear in the internal audit dashboard for agency use.
 */
const REPORT_EXCLUDED_CHECKS = new Set([
  "from_sitemap",                         // Unreliable — depends on whether the crawl ingested the sitemap correctly
  "has_micromarkup",                      // Informational — not all pages need structured data
  "meta_charset_consistency",             // Too technical, rarely actionable
  "seo_friendly_url",                     // Vague — DFS often flags normal URLs
  "seo_friendly_url_characters_check",    // Too granular for a client report
  "seo_friendly_url_dynamic_check",       // Too granular for a client report
  "seo_friendly_url_keywords_check",      // Too granular for a client report
  "seo_friendly_url_relative_length_check", // Too granular for a client report
  "no_encoding_meta_tag",                 // Very technical, rarely impacts SEO
  "no_doctype",                           // Very technical, rarely impacts SEO
  "has_html_doctype",                     // Very technical, rarely impacts SEO
  "no_content_encoding",                  // Server config — too technical for clients
  "low_character_count",                  // Confusing — overlaps with low_content_rate
  "no_favicon",                           // Minor, not worth highlighting
  "canonical",                            // Technical — handled by "has canonical" positive check
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
 * Client-friendly descriptions explaining what each issue means and why it matters.
 * Used in client-facing reports to make technical SEO accessible.
 */
export const CHECK_DESCRIPTIONS: Record<string, string> = {
  // Critical issues
  no_title: "This page is missing a title tag — the clickable headline that appears in Google search results. Without it, Google may show random text from your page, reducing clicks.",
  no_description: "This page lacks a meta description — the short summary under your title in search results. Adding one helps Google understand your page and improves click-through rates.",
  no_h1_tag: "This page has no main heading (H1). Google uses headings to understand what your page is about. Every page should have one clear, descriptive heading.",
  is_broken: "This page returns an error and isn't accessible to visitors. Broken pages hurt user experience and can negatively impact your search rankings.",
  is_4xx_code: "This page returns a 'not found' error (like a 404). This means visitors and search engines can't access it, which wastes your link authority.",
  is_5xx_code: "This page has a server error, meaning it's not loading at all. This requires immediate attention as it blocks both visitors and search engines.",
  duplicate_title: "Multiple pages share the same title tag. Each page should have a unique title so Google can distinguish them in search results.",
  duplicate_description: "Multiple pages share the same meta description. Unique descriptions help each page stand out in search results.",
  duplicate_title_tag: "This page has more than one title tag, which can confuse search engines about which one to use.",
  canonical_to_broken: "This page's canonical tag points to a broken URL. This means Google may not index the page correctly.",

  // Warning issues
  title_too_long: "This page's title is over 60 characters and will be cut off in Google search results. Shorter titles display fully and get more clicks.",
  title_too_short: "This page's title is under 30 characters. A slightly longer, more descriptive title helps Google understand your page and attracts more clicks.",
  description_too_long: "This page's meta description exceeds 160 characters and will be truncated in search results.",
  description_too_short: "This page's meta description is under 70 characters. A more detailed description gives searchers more reason to click.",
  low_content_rate: "This page has a low text-to-HTML ratio, meaning very little actual content compared to code. Adding more written content helps Google understand and rank your page.",
  low_readability_rate: "This page's content may be difficult for visitors to read. Simpler, clearer writing improves engagement and keeps visitors on your site longer.",
  has_render_blocking_resources: "This page loads scripts or styles that delay the visible content from appearing. This slows down your page and can hurt both user experience and search rankings.",
  https_to_http_links: "This secure (HTTPS) page links to insecure (HTTP) pages. This can trigger browser warnings and reduce visitor trust.",
  redirect_chain: "This page goes through multiple redirects before reaching the final URL. Each redirect slows the page down and dilutes your link authority.",
  has_redirect_chain: "This page is part of a redirect chain, which can slow page loading and reduce SEO value.",
  has_links_to_redirects: "This page contains links that go through unnecessary redirects. Updating these to point directly to the final URLs improves page speed.",
  duplicate_meta_tags: "This page has duplicate meta tags, which can confuse search engines about which values to use.",
  is_orphan_page: "This page has no internal links pointing to it, making it hard for visitors and search engines to find.",
  no_image_alt: "Images on this page are missing descriptive alt text. Alt text helps Google understand your images and improves accessibility for visually impaired visitors.",
  large_page_size: "This page is unusually large, which can slow loading times — especially on mobile devices. Optimizing images and code can significantly speed it up.",
  high_loading_time: "This page takes a long time to fully load. Slow pages frustrate visitors and rank lower in Google search results.",
  high_waiting_time: "Your server takes too long to respond for this page. This can be caused by slow hosting, heavy database queries, or missing caching.",
  irrelevant_description: "This page's meta description doesn't match its actual content. Google may ignore it or rewrite it, reducing your control over how the page appears in search.",
  irrelevant_title: "This page's title doesn't match its actual content. This can confuse both visitors and search engines.",
  has_meta_refresh_redirect: "This page uses a meta refresh redirect, which is slower and less reliable than a proper server redirect.",
  has_micromarkup_errors: "This page has structured data (schema markup) with errors. Fixing these helps Google display rich results like star ratings and FAQs.",
  is_redirect: "This page redirects to another URL. If intentional, this is fine — but too many redirects can slow your site and confuse search engines.",
  recursive_canonical: "This page's canonical tag points to itself in a loop, which can confuse search engines.",
  canonical_chain: "This page's canonical tag points to another page that also has a canonical tag — creating a chain that search engines may not follow correctly.",
  canonical_to_redirect: "This page's canonical tag points to a URL that redirects. It should point directly to the final destination.",
  deprecated_html_tags: "This page uses outdated HTML tags. While not a major ranking factor, modernizing your code improves compatibility across browsers.",
  lorem_ipsum: "This page contains placeholder text that was never replaced with real content.",
  is_link_relation_conflict: "This page has conflicting link relationship attributes, which can send mixed signals to search engines about whether to index it.",
  size_greater_than_3mb: "This page is extremely large (over 3MB), which significantly impacts loading speed.",
  flash: "This page uses Flash, which is no longer supported by most browsers and is invisible to search engines.",
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

/**
 * Get a client-friendly description for a check key.
 */
export function getCheckDescription(key: string): string | null {
  return CHECK_DESCRIPTIONS[key] || null;
}

/**
 * Returns failed checks filtered for CLIENT-FACING REPORTS.
 * Excludes noisy, unreliable, or overly-technical checks.
 */
export function getReportFailedChecks(checks: Record<string, boolean>): string[] {
  return getRealFailedChecks(checks).filter((key) => !REPORT_EXCLUDED_CHECKS.has(key));
}
