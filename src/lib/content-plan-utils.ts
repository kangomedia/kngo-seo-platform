/**
 * Content-plan utilities.
 *
 * The platform generates 2x of each content type so the agency has reserve
 * pieces to swap in when the client rejects a primary. The client must NEVER
 * see the reserve count — they only see the first N (= their tier quota) of
 * each type, ordered by sortOrder.
 */

export type ContentType = "BLOG_POST" | "GBP_POST" | "GBP_QA" | "PRESS_RELEASE";

export interface QuotaTargets {
  BLOG_POST: number;
  GBP_POST: number;
  GBP_QA: number;
  PRESS_RELEASE: number;
}

export function quotasFromClient(client: {
  monthlyBlogs?: number | null;
  monthlyGbpPosts?: number | null;
  monthlyGbpQAs?: number | null;
  monthlyPressReleases?: number | null;
}): QuotaTargets {
  return {
    BLOG_POST: client.monthlyBlogs ?? 0,
    GBP_POST: client.monthlyGbpPosts ?? 0,
    GBP_QA: client.monthlyGbpQAs ?? 0,
    PRESS_RELEASE: client.monthlyPressReleases ?? 0,
  };
}

interface PieceLike {
  type: string;
  sortOrder: number;
  approval?: { outcome: string } | null;
  status?: string;
}

/**
 * Return only the primary pieces — first N of each type by sortOrder, where
 * N is the client's quota. Approved pieces always count toward the quota and
 * are kept; rejected/save_for_later pieces are NOT skipped over (a rejected
 * primary stays a primary so the client can still see the rejection state).
 *
 * If the agency wants to actually fill the quota after rejections, they swap
 * a reserve into a primary slot via the agency UI (changes sortOrder).
 */
export function selectPrimaryPieces<T extends PieceLike>(
  pieces: T[],
  quotas: QuotaTargets,
): T[] {
  const sorted = [...pieces].sort((a, b) => a.sortOrder - b.sortOrder);
  const taken: Record<string, number> = { BLOG_POST: 0, GBP_POST: 0, GBP_QA: 0, PRESS_RELEASE: 0 };
  const result: T[] = [];

  for (const p of sorted) {
    const quota = (quotas as unknown as Record<string, number>)[p.type] ?? 0;
    if ((taken[p.type] ?? 0) < quota) {
      taken[p.type] = (taken[p.type] ?? 0) + 1;
      result.push(p);
    }
  }
  return result;
}

/**
 * How many pieces will the client see as "to review" right now? Mirrors the
 * server-side computation in /api/content/send-plan-for-approval: counts
 * unreviewed primary pieces, where the per-type quota is filled with already-
 * approved pieces first.
 */
export function countPiecesPendingReview(
  pieces: PieceLike[],
  quotas: QuotaTargets,
): number {
  const sorted = [...pieces].sort((a, b) => a.sortOrder - b.sortOrder);
  const approved: Record<string, number> = { BLOG_POST: 0, GBP_POST: 0, GBP_QA: 0, PRESS_RELEASE: 0 };
  const pending: Record<string, number> = { BLOG_POST: 0, GBP_POST: 0, GBP_QA: 0, PRESS_RELEASE: 0 };

  for (const p of sorted) {
    const quota = (quotas as unknown as Record<string, number>)[p.type] ?? 0;
    if (p.approval?.outcome === "approved") {
      approved[p.type] = (approved[p.type] ?? 0) + 1;
      continue;
    }
    if (p.approval?.outcome === "rejected" || p.approval?.outcome === "save_for_later") continue;
    if ((approved[p.type] ?? 0) + (pending[p.type] ?? 0) < quota) {
      pending[p.type] = (pending[p.type] ?? 0) + 1;
    }
  }
  return Object.values(pending).reduce((a, b) => a + b, 0);
}
