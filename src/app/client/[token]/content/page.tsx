"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getClientContentForReview, submitPublicContentApproval } from "@/lib/actions-public";
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

export default function ContentApprovalPage() {
  const params = useParams();
  const token = params.token as string;

  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [planTitle, setPlanTitle] = useState("");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getClientContentForReview(token);
      if (data && data.pieces.length > 0) {
        setPieces(data.pieces as unknown as ContentPiece[]);
        setPlanTitle(data.pieces[0]?.contentPlan?.title || "Content Review");
      }
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "#E34234", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "#888" }}>Loading content...</p>
        </div>
      </div>
    );
  }

  if (pieces.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText size={40} className="mx-auto mb-4" style={{ color: "#ccc" }} />
        <h2 className="text-lg font-bold mb-2" style={{ color: "#222" }}>No Content to Review</h2>
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
          Content Review
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
            decision === "approved" ? "#dcfce7" :
            decision === "rejected" ? "#fee2e2" :
            decision === "save_for_later" ? "#fef3c7" :
            i === currentIndex ? "#fff0ef" : "#F5F5F5";
          const textColor =
            decision === "approved" ? "#16a34a" :
            decision === "rejected" ? "#dc2626" :
            decision === "save_for_later" ? "#b45309" :
            i === currentIndex ? "#E34234" : "#888";

          return (
            <button
              key={piece.id}
              onClick={() => setCurrentIndex(i)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
              style={{ background: bgColor, color: textColor, border: i === currentIndex ? "2px solid #E34234" : "2px solid transparent" }}
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
