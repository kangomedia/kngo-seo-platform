"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, Suspense } from "react";
import {
  getClientContentForReview,
  submitPublicContentApproval,
  submitPublicPlanApproval,
} from "@/lib/actions-public";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  FileText,
  MapPin,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  BookmarkPlus,
  Send,
  ClipboardList,
} from "lucide-react";

type Decision = "approved" | "rejected" | "save_for_later" | "request_edits" | null;

// Strip internal jargon and metadata that older promotions appended to the
// description — e.g. "_Pillar: Quick Wins_" and "_Funnel stage: TOFU_".
// The newer promote endpoint no longer adds these, but existing ContentPieces
// still carry them. We also strip the TOFU/MOFU/BOFU acronyms from any
// remaining sentences in case they leaked in via other channels.
function cleanDescription(desc: string | null): string {
  if (!desc) return "";
  return desc
    .replace(/_Pillar:\s*[^_]+_/gi, "")
    .replace(/_Funnel stage:\s*(TOFU|MOFU|BOFU)_/gi, "")
    .replace(/\b(TOFU|MOFU|BOFU)\b/g, "") // catch any unwrapped mentions
    .replace(/\n{3,}/g, "\n\n")            // collapse extra blank lines
    .trim();
}

/** Lightweight markdown renderer for draft body — handles headings, bold/italic,
 *  lists, blockquotes, and paragraphs. No external deps. */
function renderMarkdown(md: string): string {
  return `<div class="prose">${md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:800;margin:20px 0 8px;color:#222">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:800;margin:24px 0 10px;color:#222">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:800;margin:0 0 16px;color:#222">$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:20px;margin-bottom:4px">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:20px;margin-bottom:4px;list-style:decimal">$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #E34234;padding-left:16px;margin:12px 0;color:#666;font-style:italic">$1</blockquote>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #E4E4E4;margin:20px 0" />')
    .replace(/\n\n/g, '</p><p style="margin-bottom:12px">')
    .replace(/\n/g, '<br />')}</div>`;
}

interface ContentPiece {
  id: string;
  title: string;
  description: string | null;
  keyword: string | null;
  type: string;
  body: string | null;
  isReserve: boolean;
  approval?: { outcome: string; notes?: string | null } | null;
}

interface ContentPlan {
  id: string;
  title: string;
  month: number;
  year: number;
  pieces: ContentPiece[];
}

// Card-by-card phase for plan review
type PlanPhase = "review" | "summary" | "done";

function ContentApprovalInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const modeParam = searchParams.get("mode");

  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [planTitle, setPlanTitle] = useState("");
  const [planForReview, setPlanForReview] = useState<ContentPlan | null>(null);
  const [detectedMode, setDetectedMode] = useState<"plan" | "drafts" | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [planPhase, setPlanPhase] = useState<PlanPhase>("review");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [clientLimits, setClientLimits] = useState({
    monthlyBlogs: 0,
    monthlyGbpPosts: 0,
    monthlyGbpQAs: 0,
    monthlyPressReleases: 0,
  });

  useEffect(() => {
    async function load() {
      // Single fetch that returns: active draft pieces, pending plan, and the
      // list of pieces the client previously rejected/saved (for restoration).
      const data = await getClientContentForReview(token);
      if (data) {
        if (data.client) {
          setClientLimits({
            monthlyBlogs: data.client.monthlyBlogs || 0,
            monthlyGbpPosts: data.client.monthlyGbpPosts || 0,
            monthlyGbpQAs: data.client.monthlyGbpQAs || 0,
            monthlyPressReleases: data.client.monthlyPressReleases || 0,
          });
        }
        // Set draft pieces if available
        if (data.pieces.length > 0) {
          setPieces(data.pieces as unknown as ContentPiece[]);
          setPlanTitle(
            (data.pieces[0] as unknown as { contentPlan?: { title?: string } })?.contentPlan?.title || "Content Review"
          );
        }
        // Set pending plan. We do NOT pre-populate `decisions` from the DB —
        // anything the client previously decided (approved/rejected/saved) is
        // final until the agency restores it. The active queue only contains
        // pieces that are truly unreviewed.
        if (data.pendingPlan) {
          setPlanForReview(data.pendingPlan as unknown as ContentPlan);
          setDecisions({});
          setNotes({});
          setCurrentIndex(0);
          setPlanPhase("review");
        }

        // Auto-detect mode: explicit param > pending plan > drafts
        if (modeParam === "plan" && data.pendingPlan) {
          setDetectedMode("plan");
        } else if (data.pieces.length > 0) {
          setDetectedMode("drafts");
        } else if (data.pendingPlan) {
          setDetectedMode("plan");
        }
      }
      setLoading(false);
    }
    load();
  }, [token, modeParam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div
            className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: "#E34234", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "#888" }}>
            Loading content...
          </p>
        </div>
      </div>
    );
  }

  // ═══ PLAN REVIEW MODE ═══
  if (detectedMode === "plan") {
    if (!planForReview) {
      return (
        <div className="text-center py-16">
          <ClipboardList size={40} className="mx-auto mb-4" style={{ color: "#ccc" }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: "#222" }}>No Content Plan to Review</h2>
          <p className="text-sm" style={{ color: "#888" }}>There are no content plans pending your review at this time.</p>
        </div>
      );
    }

    // All pieces loaded from the plan
    const allPlanPieces = planForReview.pieces as ContentPiece[];

    // Compute quota targets from client limits
    const quotaTargets: Record<string, number> = {
      BLOG_POST: clientLimits.monthlyBlogs,
      GBP_POST: clientLimits.monthlyGbpPosts,
      GBP_QA: clientLimits.monthlyGbpQAs,
      PRESS_RELEASE: clientLimits.monthlyPressReleases,
    };

    // Compute approved counts (DB approvals + this-session approvals). Used
    // for the per-type badge ("X of N approved") and for the summary's
    // shortfall warning.
    const approvedCounts: Record<string, number> = { BLOG_POST: 0, GBP_POST: 0, GBP_QA: 0, PRESS_RELEASE: 0 };
    for (const p of allPlanPieces) {
      if (p.approval?.outcome === "approved" || decisions[p.id] === "approved") {
        approvedCounts[p.type] = (approvedCounts[p.type] || 0) + 1;
      }
    }

    // Active queue: only pieces awaiting decision in THIS session.
    // - Pieces decided in a prior session (any outcome in the DB) are
    //   excluded — the client is not asked to re-review them.
    // - Pieces decided in the current session stay in the queue so the
    //   client can navigate back and change their mind before submitting.
    // - Truly unreviewed pieces are included up to (quota - approved) per type.
    //
    // After building the queue we sort it by content type so the client
    // reviews ALL blog posts, then ALL Google Business posts, then ALL Q&As,
    // then ALL press releases — instead of having the queue interleaved by
    // each piece's original sortOrder.
    const TYPE_SORT_ORDER: Record<string, number> = {
      BLOG_POST: 0,
      GBP_POST: 1,
      GBP_QA: 2,
      PRESS_RELEASE: 3,
    };
    const planPieces: ContentPiece[] = (() => {
      const result: ContentPiece[] = [];
      const pendingCounts: Record<string, number> = { BLOG_POST: 0, GBP_POST: 0, GBP_QA: 0, PRESS_RELEASE: 0 };

      for (const p of allPlanPieces) {
        if (p.approval?.outcome) continue; // already decided in DB
        if (decisions[p.id]) {
          result.push(p);
          continue;
        }
        const limit = quotaTargets[p.type] || 0;
        if ((approvedCounts[p.type] || 0) + (pendingCounts[p.type] || 0) < limit) {
          pendingCounts[p.type] = (pendingCounts[p.type] || 0) + 1;
          result.push(p);
        }
      }
      // Stable sort by type-priority. Pieces of the same type keep their
      // original sortOrder relative to each other.
      return result.sort(
        (a, b) =>
          (TYPE_SORT_ORDER[a.type] ?? 99) - (TYPE_SORT_ORDER[b.type] ?? 99)
      );
    })();

    const typeLabels: Record<string, { emoji: string; label: string }> = {
      BLOG_POST: { emoji: "✍️", label: "Blog Post" },
      GBP_POST: { emoji: "📍", label: "Google Business Post" },
      GBP_QA: { emoji: "❓", label: "Google Profile Q&A" },
      PRESS_RELEASE: { emoji: "📢", label: "Press Release" },
    };
    const reviewedCount = planPieces.filter((p) => decisions[p.id]).length;
    const pct = planPieces.length > 0 ? Math.round(((currentIndex + 1) / planPieces.length) * 100) : 0;

    const handlePlanDecision = (pieceId: string, decision: Decision) => {
      setDecisions((prev) => {
        const updated = { ...prev, [pieceId]: decision };

        // Recompute the queue with the new decision applied so we know
        // whether to advance or jump to the summary screen. This mirrors
        // the planPieces algorithm above (DB-decided skipped; this-session
        // decisions stay in queue; unreviewed up to quota).
        const tempApproved: Record<string, number> = { BLOG_POST: 0, GBP_POST: 0, GBP_QA: 0, PRESS_RELEASE: 0 };
        for (const p of allPlanPieces) {
          if (p.approval?.outcome === "approved" || updated[p.id] === "approved") {
            tempApproved[p.type] = (tempApproved[p.type] || 0) + 1;
          }
        }
        const tempResult: ContentPiece[] = [];
        const tempPending: Record<string, number> = { BLOG_POST: 0, GBP_POST: 0, GBP_QA: 0, PRESS_RELEASE: 0 };
        for (const p of allPlanPieces) {
          if (p.approval?.outcome) continue;
          if (updated[p.id]) {
            tempResult.push(p);
            continue;
          }
          const limit = quotaTargets[p.type] || 0;
          if ((tempApproved[p.type] || 0) + (tempPending[p.type] || 0) < limit) {
            tempPending[p.type] = (tempPending[p.type] || 0) + 1;
            tempResult.push(p);
          }
        }
        // Same type-priority sort as the queue above — keeps Next/Back order
        // grouped (all blogs, then GBP posts, then Q&As, then press releases).
        tempResult.sort(
          (a, b) =>
            (TYPE_SORT_ORDER[a.type] ?? 99) - (TYPE_SORT_ORDER[b.type] ?? 99)
        );

        setTimeout(() => {
          if (currentIndex < tempResult.length - 1) {
            setCurrentIndex((i) => i + 1);
          } else {
            setPlanPhase("summary");
          }
        }, 350);

        return updated;
      });
    };

    const handleSubmitPlan = async () => {
      setSubmitting(true);
      try {
        const pieceDecisions = planPieces
          .filter((p) => decisions[p.id])
          .map((p) => ({ pieceId: p.id, outcome: decisions[p.id] as string, notes: notes[p.id] }));
        const approvedCount = pieceDecisions.filter((d) => d.outcome === "approved").length;
        const overallOutcome = approvedCount > planPieces.length / 2 ? "approved" : "rejected";
        await submitPublicPlanApproval(token, planForReview.id, overallOutcome as "approved" | "rejected", undefined, pieceDecisions);
        setPlanPhase("done");
      } catch (err) {
        console.error("Failed to submit:", err);
      }
      setSubmitting(false);
    };

    // ── Done screen ──
    if (planPhase === "done") {
      const approved = planPieces.filter((p) => decisions[p.id] === "approved").length;
      const rejected = planPieces.filter((p) => decisions[p.id] === "rejected").length;
      const saved = planPieces.filter((p) => decisions[p.id] === "save_for_later").length;
      return (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#f0fdf4", border: "2px solid #86efac" }}>
            <CheckCircle2 size={28} style={{ color: "#16a34a" }} />
          </div>
          <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#222" }}>Thank You!</h2>
          <p className="text-sm mb-4" style={{ color: "#888" }}>Your feedback has been sent to the KangoMedia team.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            {approved > 0 && <span className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "#dcfce7", color: "#16a34a", border: "1.5px solid #86efac" }}>✓ {approved} Approved</span>}
            {rejected > 0 && <span className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fca5a5" }}>✕ {rejected} Rejected</span>}
            {saved > 0 && <span className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "#fef3c7", color: "#b45309", border: "1.5px solid #fcd34d" }}>◷ {saved} Saved</span>}
          </div>
        </div>
      );
    }

    // ── Summary screen ──
    if (planPhase === "summary") {
      const approved = planPieces.filter((p) => decisions[p.id] === "approved").length;
      const rejected = planPieces.filter((p) => decisions[p.id] === "rejected").length;
      const saved = planPieces.filter((p) => decisions[p.id] === "save_for_later").length;
      const skipped = planPieces.length - approved - rejected - saved;

      // Per-type quota fulfillment uses the total approved count (this session
      // PLUS prior sessions persisted in the DB) so the shortfall reflects what
      // the agency still owes after this round of feedback.
      const quotaStatus = Object.entries(quotaTargets).map(([type, target]) => {
        const typeApproved = approvedCounts[type] || 0;
        const info = typeLabels[type] || typeLabels.BLOG_POST;
        return { type, target, approved: typeApproved, label: info.label, emoji: info.emoji, shortfall: target - typeApproved };
      }).filter((q) => q.target > 0);

      const hasShortfall = quotaStatus.some((q) => q.shortfall > 0);

      return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 className="text-2xl font-extrabold mb-1" style={{ color: "#222" }}>Almost there.</h2>
          <p className="text-sm mb-5" style={{ color: "#888" }}>
            You&apos;ve reviewed {reviewedCount} of {planPieces.length} pieces.{skipped > 0 ? ` ${skipped} skipped — we won't publish those until you weigh in.` : ""} Ready to submit?
          </p>
          <div className="flex gap-3 flex-wrap mb-5">
            {approved > 0 && <div className="px-4 py-3 rounded-xl" style={{ border: "1.5px solid #86efac", background: "#f0fdf4" }}><div className="text-2xl font-extrabold" style={{ color: "#16a34a" }}>{approved}</div><div className="text-xs font-semibold" style={{ color: "#888" }}>Approved</div></div>}
            {rejected > 0 && <div className="px-4 py-3 rounded-xl" style={{ border: "1.5px solid #fca5a5", background: "#fef2f2" }}><div className="text-2xl font-extrabold" style={{ color: "#dc2626" }}>{rejected}</div><div className="text-xs font-semibold" style={{ color: "#888" }}>Rejected</div></div>}
            {saved > 0 && <div className="px-4 py-3 rounded-xl" style={{ border: "1.5px solid #fcd34d", background: "#fef3c7" }}><div className="text-2xl font-extrabold" style={{ color: "#b45309" }}>{saved}</div><div className="text-xs font-semibold" style={{ color: "#888" }}>Saved</div></div>}
            {skipped > 0 && <div className="px-4 py-3 rounded-xl" style={{ border: "1.5px solid #ddd", background: "#f6f6f6" }}><div className="text-2xl font-extrabold" style={{ color: "#aaa" }}>{skipped}</div><div className="text-xs font-semibold" style={{ color: "#888" }}>Skipped</div></div>}
          </div>

          {/* Quota exhaustion notice */}
          {hasShortfall && (
            <div className="rounded-xl p-4 mb-5" style={{ background: "#fffbeb", border: "1.5px solid #fcd34d" }}>
              <p className="text-sm font-bold mb-2" style={{ color: "#92400e" }}>⚠️ Some quotas are below your plan</p>
              {quotaStatus.filter((q) => q.shortfall > 0).map((q) => (
                <p key={q.type} className="text-xs mb-1" style={{ color: "#78350f" }}>
                  {q.emoji} {q.label}: {q.approved} of {q.target} approved ({q.shortfall} short)
                </p>
              ))}
              <p className="text-xs mt-2" style={{ color: "#92400e" }}>
                No worries — our team will come up with additional ideas and present them to you shortly.
              </p>
            </div>
          )}

          {/* Per-type breakdown */}
          {["BLOG_POST", "GBP_POST", "GBP_QA", "PRESS_RELEASE"].map((type) => {
            const typePieces = planPieces.filter((p) => p.type === type);
            const decided = typePieces.filter((p) => decisions[p.id]);
            if (decided.length === 0) return null;
            const info = typeLabels[type] || typeLabels.BLOG_POST;
            const target = quotaTargets[type] || 0;
            const typeApproved = approvedCounts[type] || 0;
            return (
              <div key={type} className="rounded-xl overflow-hidden mb-3" style={{ background: "#fff", border: "1px solid #E4E4E4" }}>
                <div className="px-4 py-2 flex items-center justify-between" style={{ background: "#FAFAFA", borderBottom: "1px solid #E4E4E4" }}>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#888" }}>{info.emoji} {info.label}</span>
                  <span className="text-xs font-bold" style={{ color: typeApproved >= target ? "#16a34a" : "#b45309" }}>
                    {typeApproved} / {target} approved
                  </span>
                </div>
                {decided.map((p) => {
                  const d = decisions[p.id];
                  const pillStyle = d === "approved" ? { background: "#f0fdf4", color: "#16a34a", border: "1.5px solid #86efac" } : d === "rejected" ? { background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fca5a5" } : { background: "#fef3c7", color: "#b45309", border: "1.5px solid #fcd34d" };
                  const pillLabel = d === "approved" ? "Approved" : d === "rejected" ? "Rejected" : "Saved";
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderTop: "1px solid #f0f0f0" }}>
                      <span className="text-sm font-semibold" style={{ color: "#222", flex: 1 }}>{p.title}</span>
                      <span className="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap" style={pillStyle}>{pillLabel}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="flex items-center gap-3 mt-5">
            <button onClick={() => { setCurrentIndex(planPieces.length - 1); setPlanPhase("review"); }} className="px-5 py-3 rounded-xl text-sm font-bold" style={{ background: "#fff", border: "1.5px solid #E4E4E4", color: "#222" }}>← Go Back</button>
            <button onClick={handleSubmitPlan} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold" style={{ background: submitting ? "#999" : "#E34234", color: "#fff" }}>
              <Send size={16} /> {submitting ? "Submitting..." : "Submit Feedback →"}
            </button>
          </div>
        </div>
      );
    }

    // ── Card-by-card review ──
    if (planPieces.length === 0) {
      return (
        <div style={{ maxWidth: 640, margin: "0 auto" }} className="text-center py-16">
          <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: "#86efac" }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: "#222" }}>You&apos;re all caught up</h2>
          <p className="text-sm" style={{ color: "#888" }}>
            We&apos;ll let you know when there&apos;s more content to review.
          </p>
        </div>
      );
    }

    const currentPiece = planPieces[currentIndex];
    const typeInfo = typeLabels[currentPiece?.type] || typeLabels.BLOG_POST;

    // Group pieces by type for the sidebar TOC. Order: Blog → GBP Post →
    // GBP Q&A → Press Release. Each group shows its title list with status.
    const TYPE_ORDER: Array<ContentPiece["type"]> = [
      "BLOG_POST",
      "GBP_POST",
      "GBP_QA",
      "PRESS_RELEASE",
    ];
    const tocGroups = TYPE_ORDER.map((t) => ({
      type: t,
      label: typeLabels[t]?.label || t,
      emoji: typeLabels[t]?.emoji || "•",
      pieces: planPieces
        .map((p, originalIndex) => ({ p, originalIndex }))
        .filter(({ p }) => p.type === t),
    })).filter((g) => g.pieces.length > 0);

    const sidebar = (
      <aside
        className="rounded-2xl p-3 self-start"
        style={{
          background: "#fff",
          border: "1px solid #E4E4E4",
          // Sticky on wide screens so the sidebar stays in view while
          // scrolling through the review card on the right.
          position: "sticky",
          top: 16,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
        }}
      >
        <p
          className="text-[10px] font-extrabold uppercase tracking-widest mb-3 px-1"
          style={{ color: "#888" }}
        >
          Jump to a piece
        </p>
        {tocGroups.map((group, gi) => {
          const groupApproved = group.pieces.filter(
            ({ p }) =>
              p.approval?.outcome === "approved" || decisions[p.id] === "approved"
          ).length;
          return (
            <div key={group.type} style={{ marginBottom: gi === tocGroups.length - 1 ? 0 : 14 }}>
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-xs font-extrabold" style={{ color: "#444" }}>
                  {group.emoji} {group.label}
                </span>
                <span className="text-[10px] font-bold" style={{ color: "#888" }}>
                  {groupApproved} / {group.pieces.length}
                </span>
              </div>
              <ul className="flex flex-col gap-0.5">
                {group.pieces.map(({ p, originalIndex }) => {
                  const d = decisions[p.id] || p.approval?.outcome;
                  const isActive = currentIndex === originalIndex;
                  let statusDot: { bg: string; ring: string } = { bg: "transparent", ring: "#E4E4E4" };
                  if (d === "approved") statusDot = { bg: "#16a34a", ring: "#16a34a" };
                  else if (d === "rejected") statusDot = { bg: "#dc2626", ring: "#dc2626" };
                  else if (d === "save_for_later") statusDot = { bg: "#b45309", ring: "#b45309" };
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => setCurrentIndex(originalIndex)}
                        className="w-full text-left px-2 py-1.5 rounded-lg flex items-start gap-2 transition-all"
                        style={{
                          background: isActive ? "#fff0ef" : "transparent",
                          border: `1px solid ${isActive ? "#E34234" : "transparent"}`,
                          color: "#222",
                          cursor: "pointer",
                        }}
                        title={p.title}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: statusDot.bg,
                            border: `1.5px solid ${statusDot.ring}`,
                            marginTop: 6,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          className="text-xs leading-snug"
                          style={{
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? "#E34234" : "#444",
                            // 2-line clamp so very long titles don't blow up the sidebar.
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                            overflow: "hidden",
                          }}
                        >
                          {p.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </aside>
    );

    return (
      <div
        className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-4"
        style={{ maxWidth: 1100, margin: "0 auto" }}
      >
        {sidebar}
        <div style={{ maxWidth: 640, width: "100%", justifySelf: "center" }}>
        {/* Progress bar */}
        <div className="mb-4 rounded-xl px-4 py-3" style={{ background: "#fff", border: "1px solid #E4E4E4" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={{ color: "#888" }}>Overall progress</span>
            <span className="text-xs font-bold" style={{ color: "#888" }}>{currentIndex + 1} / {planPieces.length}</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 4, background: "#E4E4E4" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "#E34234" }} />
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: "#888" }}>{reviewedCount} of {planPieces.length} reviewed</p>
        </div>

        {/* Content card */}
        {currentPiece && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E4E4E4", animation: "slideUp .22s ease both" }} key={`${currentPiece.id}-${currentIndex}`}>
            {/* Type banner */}
            <div className="px-5 py-3 flex items-center gap-3" style={{ background: "#FAFAFA", borderBottom: "1px solid #E4E4E4" }}>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: "#888", marginBottom: 2 }}>You&apos;re reviewing</div>
                <div className="text-lg font-extrabold" style={{ color: "#222" }}>
                  {typeInfo.emoji} {typeInfo.label}
                  {(currentPiece as ContentPiece & { isReserve?: boolean }).isReserve && (
                    <span className="ml-2 text-[10px] font-bold px-2 py-1 rounded-full align-middle" style={{ background: "#dbeafe", color: "#2563eb", border: "1px solid #93c5fd" }}>
                      🔄 New Option
                    </span>
                  )}
                </div>
              </div>
              {(() => {
                const target = quotaTargets[currentPiece.type] || 0;
                const approvedOfType = approvedCounts[currentPiece.type] || 0;
                const reachedQuota = approvedOfType >= target;
                return (
                  <span
                    className="ml-auto text-xs font-bold px-3 py-1 rounded-full"
                    style={{
                      background: reachedQuota ? "#f0fdf4" : "#FAFAFA",
                      border: `1.5px solid ${reachedQuota ? "#86efac" : "#E4E4E4"}`,
                      color: reachedQuota ? "#16a34a" : "#888",
                    }}
                  >
                    {approvedOfType} of {target} approved
                  </span>
                );
              })()}
            </div>

            {/* Content */}
            <div className="p-5">
              <h2 className="text-xl font-extrabold mb-3" style={{ color: "#222", lineHeight: 1.3 }}>{currentPiece.title}</h2>
              {currentPiece.type === "BLOG_POST" && <p className="text-[10px] font-extrabold uppercase tracking-widest mb-2" style={{ color: "#888" }}>Proposed Angle</p>}
              {(() => {
                const cleaned = cleanDescription(currentPiece.description);
                return cleaned ? (
                  <p className="text-sm leading-relaxed mb-3" style={{ color: "#444", lineHeight: 1.75 }}>{cleaned}</p>
                ) : null;
              })()}
              {currentPiece.keyword && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-3" style={{ background: "#fff0ef", color: "#E34234" }}>
                  🎯 Target: {currentPiece.keyword}
                </div>
              )}
              <div style={{ height: 1, background: "#E4E4E4", margin: "4px -20px 16px" }} />
              <label className="text-[11px] font-extrabold uppercase tracking-wide mb-2 block" style={{ color: "#222" }}>
                Your notes <span className="font-medium normal-case tracking-normal" style={{ color: "#888" }}>— optional</span>
              </label>
              <textarea
                className="w-full p-3 rounded-xl text-sm resize-vertical"
                style={{ background: "#F5F5F5", border: "1.5px solid #E4E4E4", color: "#222", minHeight: 80 }}
                placeholder="Add thoughts, ideas, or changes you'd like to see…"
                value={notes[currentPiece.id] || ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [currentPiece.id]: e.target.value }))}
              />
            </div>

            {/* Decision buttons */}
            <div className="px-5 py-4" style={{ borderTop: "1px solid #E4E4E4" }}>
              <p className="text-[11px] font-extrabold uppercase tracking-widest mb-3" style={{ color: "#888" }}>Your call on this one</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePlanDecision(currentPiece.id, "approved")}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-extrabold transition-all"
                  style={{
                    background: decisions[currentPiece.id] === "approved" ? "#16a34a" : "#f0fdf4",
                    color: decisions[currentPiece.id] === "approved" ? "#fff" : "#16a34a",
                    border: "2px solid #86efac",
                    boxShadow: decisions[currentPiece.id] === "approved" ? "0 3px 10px rgba(22,163,74,.35)" : "none",
                  }}
                >
                  <CheckCircle2 size={16} /> Approve
                </button>
                <button
                  onClick={() => handlePlanDecision(currentPiece.id, "rejected")}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-extrabold transition-all"
                  style={{
                    background: decisions[currentPiece.id] === "rejected" ? "#dc2626" : "#fef2f2",
                    color: decisions[currentPiece.id] === "rejected" ? "#fff" : "#dc2626",
                    border: "2px solid #fca5a5",
                    boxShadow: decisions[currentPiece.id] === "rejected" ? "0 3px 10px rgba(220,38,38,.35)" : "none",
                  }}
                >
                  <XCircle size={16} /> Reject
                </button>
                <button
                  onClick={() => handlePlanDecision(currentPiece.id, "save_for_later")}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-extrabold transition-all"
                  style={{
                    background: decisions[currentPiece.id] === "save_for_later" ? "#b45309" : "#fef3c7",
                    color: decisions[currentPiece.id] === "save_for_later" ? "#fff" : "#b45309",
                    border: "2px solid #fcd34d",
                    boxShadow: decisions[currentPiece.id] === "save_for_later" ? "0 3px 10px rgba(180,83,9,.3)" : "none",
                  }}
                >
                  <BookmarkPlus size={16} /> Later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#fff", border: "1.5px solid #E4E4E4", color: currentIndex === 0 ? "#ccc" : "#222", cursor: currentIndex === 0 ? "not-allowed" : "pointer" }}
          >
            <ChevronLeft size={16} /> Back
          </button>
          {currentIndex === planPieces.length - 1 ? (
            <button
              onClick={() => setPlanPhase("summary")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "#E34234", color: "#fff" }}
            >
              Review Summary <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex((i) => i + 1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "#fff", border: "1.5px solid #E4E4E4", color: "#222" }}
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
        </div>
      </div>
    );
  }

  // ═══ DRAFT REVIEW MODE (original) ═══
  if (pieces.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText size={40} className="mx-auto mb-4" style={{ color: "#ccc" }} />
        <h2 className="text-lg font-bold mb-2" style={{ color: "#222" }}>
          No Content to Review
        </h2>
        <p className="text-sm" style={{ color: "#888" }}>
          When your SEO team creates content for you, it will appear here for your review.
        </p>
      </div>
    );
  }

  const currentPiece = pieces[currentIndex];
  const reviewedCount = Object.keys(decisions).length;

  const typeLabels: Record<string, { icon: React.ReactNode; label: string; emoji: string }> = {
    BLOG_POST: { icon: <FileText size={16} />, label: "Blog Post", emoji: "✍️" },
    GBP_POST: { icon: <MapPin size={16} />, label: "Google Business Post", emoji: "📍" },
    GBP_QA: { icon: <FileText size={16} />, label: "Google Profile Q&A", emoji: "❓" },
    PRESS_RELEASE: { icon: <Megaphone size={16} />, label: "Press Release", emoji: "📢" },
  };

  const handleDecision = (pieceId: string, decision: Decision) => {
    setDecisions((prev) => ({ ...prev, [pieceId]: decision }));
    if (currentIndex < pieces.length - 1) {
      setTimeout(() => setCurrentIndex((i) => i + 1), 400);
    }
  };

  const handleSubmitAll = async () => {
    setSubmitting(true);
    try {
      for (const [pieceId, decision] of Object.entries(decisions)) {
        if (decision) {
          await submitPublicContentApproval(token, pieceId, decision, notes[pieceId]);
        }
      }
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit:", err);
    }
    setSubmitting(false);
  };

  const allReviewed = reviewedCount === pieces.length;

  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#222" }}>
          Thank You!
        </h2>
        <p className="text-sm" style={{ color: "#888" }}>
          Your feedback has been sent to the KangoMedia team. We&apos;ll get to work on it right away.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1" style={{ color: "#222" }}>
          ✍️ Draft Review
        </h1>
        <p className="text-sm" style={{ color: "#888" }}>
          {planTitle} · {reviewedCount} of {pieces.length} reviewed
        </p>

        {/* Progress Bar */}
        <div
          className="mt-3 rounded-full overflow-hidden"
          style={{ height: 6, background: "#E4E4E4" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(reviewedCount / pieces.length) * 100}%`,
              background: allReviewed ? "#16a34a" : "#E34234",
            }}
          />
        </div>
      </div>

      {/* Quick Nav Pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {pieces.map((piece, i) => {
          const decision = decisions[piece.id];
          const bgColor =
            decision === "approved"
              ? "#dcfce7"
              : decision === "rejected"
                ? "#fee2e2"
                : decision === "save_for_later" || decision === "request_edits"
                  ? "#fef3c7"
                  : i === currentIndex
                    ? "#fff0ef"
                    : "#F5F5F5";
          const textColor =
            decision === "approved"
              ? "#16a34a"
              : decision === "rejected"
                ? "#dc2626"
                : decision === "save_for_later" || decision === "request_edits"
                  ? "#b45309"
                  : i === currentIndex
                    ? "#E34234"
                    : "#888";

          return (
            <button
              key={piece.id}
              onClick={() => setCurrentIndex(i)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
              style={{
                background: bgColor,
                color: textColor,
                border: i === currentIndex ? "2px solid #E34234" : "2px solid transparent",
              }}
            >
              {decision === "approved" && <CheckCircle2 size={12} />}
              {decision === "rejected" && <XCircle size={12} />}
              {decision === "save_for_later" && <BookmarkPlus size={12} />}
              {decision === "request_edits" && <MessageSquare size={12} />}
              {i + 1}. {piece.title.substring(0, 25)}...
            </button>
          );
        })}
      </div>

      {/* Current Card */}
      {currentPiece && (
        <div
          className="rounded-2xl overflow-hidden animate-fade-in"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          key={currentPiece.id}
        >
          {/* Type Banner */}
          <div
            className="px-6 py-3 flex items-center gap-2"
            style={{ background: "#FAFAFA", borderBottom: "1px solid #E4E4E4" }}
          >
            <span className="text-lg">{typeLabels[currentPiece.type]?.emoji}</span>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#888" }}>
              {typeLabels[currentPiece.type]?.label}
            </span>
            <span className="ml-auto text-xs font-bold" style={{ color: "#888" }}>
              {currentIndex + 1} / {pieces.length}
            </span>
          </div>

          {/* Content */}
          <div className="p-6">
            <h2 className="text-xl font-extrabold mb-2" style={{ color: "#222" }}>
              {currentPiece.title}
            </h2>
            {(() => {
              const cleaned = cleanDescription(currentPiece.description);
              return cleaned ? (
                <p className="text-sm leading-relaxed mb-3" style={{ color: "#666" }}>
                  {cleaned}
                </p>
              ) : null;
            })()}
            {currentPiece.keyword && (
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold mb-4"
                style={{ background: "#F5F5F5", color: "#888" }}
              >
                🎯 Target keyword: <span style={{ color: "#222" }}>{currentPiece.keyword}</span>
              </div>
            )}

            {/* Full draft body — this is what the client actually reviews */}
            {currentPiece.body ? (
              <div
                className="rounded-xl p-5 mt-2"
                style={{ background: "#FAFAFA", border: "1px solid #E4E4E4", color: "#222", lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(currentPiece.body) }}
              />
            ) : (
              <div className="rounded-xl p-4 text-sm" style={{ background: "#FAFAFA", border: "1px solid #E4E4E4", color: "#888" }}>
                Draft is still being prepared.
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="px-6 pb-4">
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "#888" }}>
              <MessageSquare size={12} className="inline mr-1" />
              Feedback (required if requesting edits)
            </label>
            <textarea
              className="w-full p-3 rounded-xl text-sm resize-none"
              style={{
                background: "#FAFAFA",
                border: "1.5px solid #E4E4E4",
                color: "#222",
                minHeight: 80,
              }}
              placeholder="What edits would you like? Be specific so we can revise quickly…"
              value={notes[currentPiece.id] || ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [currentPiece.id]: e.target.value }))}
            />
          </div>

          {/* Decision Buttons — Approve / Request Edits / Reject */}
          <div
            className="px-6 py-4 flex items-center gap-3"
            style={{ borderTop: "1px solid #E4E4E4", background: "#FAFAFA" }}
          >
            <button
              onClick={() => handleDecision(currentPiece.id, "approved")}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: decisions[currentPiece.id] === "approved" ? "#16a34a" : "#dcfce7",
                color: decisions[currentPiece.id] === "approved" ? "#fff" : "#16a34a",
                border: "2px solid #16a34a",
              }}
            >
              <CheckCircle2 size={18} />
              Approve
            </button>
            <button
              onClick={() => handleDecision(currentPiece.id, "request_edits")}
              className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: decisions[currentPiece.id] === "request_edits" ? "#b45309" : "#fef3c7",
                color: decisions[currentPiece.id] === "request_edits" ? "#fff" : "#b45309",
                border: "2px solid #b45309",
              }}
              title="Send the draft back with your notes — we'll revise and resend"
            >
              <MessageSquare size={18} />
              Request Edits
            </button>
            <button
              onClick={() => handleDecision(currentPiece.id, "rejected")}
              className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: decisions[currentPiece.id] === "rejected" ? "#dc2626" : "#fee2e2",
                color: decisions[currentPiece.id] === "rejected" ? "#fff" : "#dc2626",
                border: "2px solid #dc2626",
              }}
              title="Reject this draft — we won't publish it"
            >
              <XCircle size={18} />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: "#fff",
            border: "1px solid #E4E4E4",
            color: currentIndex === 0 ? "#ccc" : "#222",
            cursor: currentIndex === 0 ? "not-allowed" : "pointer",
          }}
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <button
          onClick={() => setCurrentIndex((i) => Math.min(pieces.length - 1, i + 1))}
          disabled={currentIndex === pieces.length - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: "#fff",
            border: "1px solid #E4E4E4",
            color: currentIndex === pieces.length - 1 ? "#ccc" : "#222",
            cursor: currentIndex === pieces.length - 1 ? "not-allowed" : "pointer",
          }}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Submit All */}
      {allReviewed && (
        <div className="mt-6 text-center animate-slide-up">
          <button
            onClick={handleSubmitAll}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold transition-all"
            style={{
              background: submitting ? "#999" : "#E34234",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(227, 66, 52, 0.3)",
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            <Send size={18} />
            {submitting ? "Submitting..." : "Submit All Decisions"}
          </button>
          <p className="text-xs mt-2" style={{ color: "#888" }}>
            Your feedback will be sent to the KangoMedia team
          </p>
        </div>
      )}
    </div>
  );
}

export default function ContentApprovalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div
              className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: "#E34234", borderTopColor: "transparent" }}
            />
            <p className="text-sm" style={{ color: "#888" }}>Loading...</p>
          </div>
        </div>
      }
    >
      <ContentApprovalInner />
    </Suspense>
  );
}
