/**
 * URL-slug utilities. Pure functions, no DB or network — safe to import
 * from anywhere. Lives outside actions-ai.ts because that file is marked
 * `"use server"`, which restricts exports to async functions; slug helpers
 * are inherently synchronous.
 */

/**
 * Turn a title into a URL-safe slug. Lowercase, alphanumerics + hyphens,
 * stripped of leading/trailing hyphens, truncated to ~60 chars at a word
 * boundary. Used as the *planned* slug at draft generation time — the
 * operator can override at publish time.
 */
export function generateSlug(title: string, keyword?: string | null): string {
  const base = (title || keyword || "untitled")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")     // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (base.length <= 60) return base;
  const truncated = base.slice(0, 60);
  const lastDash = truncated.lastIndexOf("-");
  return lastDash > 20 ? truncated.slice(0, lastDash) : truncated;
}

/**
 * Scan a draft body for `[anchor text](slug)` markdown links where the
 * target looks like a slug (not http(s)://, no leading slash, no anchor #).
 * Used to populate the InternalLink table so we can track and resolve
 * these later.
 */
export function extractInternalLinkPlaceholders(body: string): Array<{ anchor: string; slug: string }> {
  const results: Array<{ anchor: string; slug: string }> = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const anchor = m[1].trim();
    const target = m[2].trim();
    // Skip absolute URLs, anchor-only links, mailto/tel, and placeholders
    // like "INTERNAL LINK: …" that Claude sometimes writes.
    if (/^https?:\/\//i.test(target)) continue;
    if (target.startsWith("#") || target.startsWith("/") || target.startsWith("mailto:") || target.startsWith("tel:")) continue;
    if (target.includes(":") || target.includes(" ")) continue;
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(target)) continue;
    results.push({ anchor, slug: target.toLowerCase() });
  }
  return results;
}
