"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
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

type Decision = "approved" | "rejected" | "save_for_later" | null;

interface ContentPiece {
  id: string;
  title: string;
  description: string | null;
  keyword: string | null;
  type: string;
  body: string | null;
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

  useEffect(() => {
    async function load() {
      // Single fetch that returns both draft pieces AND pending plan
      const data = await getClientContentForReview(token);
      if (data) {
        // Set draft pieces if available
        if (data.pieces.length > 0) {
          setPieces(data.pieces as unknown as ContentPiece[]);
          setPlanTitle(
            (data.pieces[0] as unknown as { contentPlan?: { title?: string } })?.contentPlan?.title || "Content Review"
          );
        }
        // Set pending plan if available
        if (data.pendingPlan) {
          setPlanForReview(data.pendingPlan as unknown as ContentPlan);
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

    const planPieces = planForReview.pieces;
    const typeLabels: Record<string, { emoji: string; label: string }> = {
      BLOG_POST: { emoji: "✍️", label: "Blog Post" },
      GBP_POST: { emoji: "📍", label: "Google Business Post" },
      PRESS_RELEASE: { emoji: "📢", label: "Press Release" },
    };
    const reviewedCount = planPieces.filter((p) => decisions[p.id]).length;
    const pct = planPieces.length > 0 ? Math.round(((currentIndex + 1) / planPieces.length) * 100) : 0;

    const handlePlanDecision = (pieceId: string, decision: Decision) => {
      setDecisions((prev) => ({ ...prev, [pieceId]: decision }));
      setTimeout(() => {
        if (currentIndex < planPieces.length - 1) {
          setCurrentIndex((i) => i + 1);
        } else {
          setPlanPhase("summary");
        }
      }, 350);
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
      return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 className="text-2xl font-extrabold mb-1" style={{ color: "#222" }}>Almost there.</h2>
          <p className="text-sm mb-5" style={{ color: "#888" }}>
            You've reviewed {reviewedCount} of {planPieces.length} pieces.{skipped > 0 ? ` ${skipped} skipped — we won't publish those until you weigh in.` : ""} Ready to submit?
          </p>
          <div className="flex gap-3 flex-wrap mb-5">
            {approved > 0 && <div className="px-4 py-3 rounded-xl" style={{ border: "1.5px solid #86efac", background: "#f0fdf4" }}><div className="text-2xl font-extrabold" style={{ color: "#16a34a" }}>{approved}</div><div className="text-xs font-semibold" style={{ color: "#888" }}>Approved</div></div>}
            {rejected > 0 && <div className="px-4 py-3 rounded-xl" style={{ border: "1.5px solid #fca5a5", background: "#fef2f2" }}><div className="text-2xl font-extrabold" style={{ color: "#dc2626" }}>{rejected}</div><div className="text-xs font-semibold" style={{ color: "#888" }}>Rejected</div></div>}
            {saved > 0 && <div className="px-4 py-3 rounded-xl" style={{ border: "1.5px solid #fcd34d", background: "#fef3c7" }}><div className="text-2xl font-extrabold" style={{ color: "#b45309" }}>{saved}</div><div className="text-xs font-semibold" style={{ color: "#888" }}>Saved</div></div>}
            {skipped > 0 && <div className="px-4 py-3 rounded-xl" style={{ border: "1.5px solid #ddd", background: "#f6f6f6" }}><div className="text-2xl font-extrabold" style={{ color: "#aaa" }}>{skipped}</div><div className="text-xs font-semibold" style={{ color: "#888" }}>Skipped</div></div>}
          </div>
          {/* Per-type breakdown */}
          {["BLOG_POST", "GBP_POST", "PRESS_RELEASE"].map((type) => {
            const typePieces = planPieces.filter((p) => p.type === type);
            const decided = typePieces.filter((p) => decisions[p.id]);
            if (decided.length === 0) return null;
            const info = typeLabels[type] || typeLabels.BLOG_POST;
            return (
              <div key={type} className="rounded-xl overflow-hidden mb-3" style={{ background: "#fff", border: "1px solid #E4E4E4" }}>
                <div className="px-4 py-2 flex items-center justify-between" style={{ background: "#FAFAFA", borderBottom: "1px solid #E4E4E4" }}>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#888" }}>{info.emoji} {info.label}</span>
                  <span className="text-xs" style={{ color: "#888" }}>{decided.length} reviewed</span>
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
    const currentPiece = planPieces[currentIndex];
    const typeInfo = typeLabels[currentPiece?.type] || typeLabels.BLOG_POST;

    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
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
                <div className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: "#888", marginBottom: 2 }}>You're reviewing</div>
                <div className="text-lg font-extrabold" style={{ color: "#222" }}>{typeInfo.emoji} {typeInfo.label}</div>
              </div>
              <span className="ml-auto text-xs font-bold px-3 py-1 rounded-full" style={{ background: "#FAFAFA", border: "1.5px solid #E4E4E4", color: "#888" }}>
                {planPieces.filter((p) => p.type === currentPiece.type).indexOf(currentPiece) + 1} of {planPieces.filter((p) => p.type === currentPiece.type).length}
              </span>
            </div>

            {/* Content */}
            <div className="p-5">
              <h2 className="text-xl font-extrabold mb-3" style={{ color: "#222", lineHeight: 1.3 }}>{currentPiece.title}</h2>
              {currentPiece.type === "BLOG_POST" && <p className="text-[10px] font-extrabold uppercase tracking-widest mb-2" style={{ color: "#888" }}>Proposed Angle</p>}
              {currentPiece.description && <p className="text-sm leading-relaxed mb-3" style={{ color: "#444", lineHeight: 1.75 }}>{currentPiece.description}</p>}
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
                : decision === "save_for_later"
                  ? "#fef3c7"
                  : i === currentIndex
                    ? "#fff0ef"
                    : "#F5F5F5";
          const textColor =
            decision === "approved"
              ? "#16a34a"
              : decision === "rejected"
                ? "#dc2626"
                : decision === "save_for_later"
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
            <h2 className="text-xl font-extrabold mb-3" style={{ color: "#222" }}>
              {currentPiece.title}
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "#666" }}>
              {currentPiece.description}
            </p>
            {currentPiece.keyword && (
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: "#F5F5F5", color: "#888" }}
              >
                🎯 Target keyword: <span style={{ color: "#222" }}>{currentPiece.keyword}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="px-6 pb-4">
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "#888" }}>
              <MessageSquare size={12} className="inline mr-1" />
              Notes (optional)
            </label>
            <textarea
              className="w-full p-3 rounded-xl text-sm resize-none"
              style={{
                background: "#FAFAFA",
                border: "1.5px solid #E4E4E4",
                color: "#222",
                minHeight: 80,
              }}
              placeholder="Add any feedback, requests, or ideas..."
              value={notes[currentPiece.id] || ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [currentPiece.id]: e.target.value }))}
            />
          </div>

          {/* Decision Buttons */}
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
              onClick={() => handleDecision(currentPiece.id, "save_for_later")}
              className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: decisions[currentPiece.id] === "save_for_later" ? "#b45309" : "#fef3c7",
                color: decisions[currentPiece.id] === "save_for_later" ? "#fff" : "#b45309",
                border: "2px solid #b45309",
              }}
            >
              <BookmarkPlus size={18} />
              Later
            </button>
            <button
              onClick={() => handleDecision(currentPiece.id, "rejected")}
              className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: decisions[currentPiece.id] === "rejected" ? "#dc2626" : "#fee2e2",
                color: decisions[currentPiece.id] === "rejected" ? "#fff" : "#dc2626",
                border: "2px solid #dc2626",
              }}
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
