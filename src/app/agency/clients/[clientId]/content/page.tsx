"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Sparkles,
  FileText,
  MapPin,
  Megaphone,
  HelpCircle,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  Loader2,
  AlertCircle,
  X,
  Copy,
  ClipboardList,
  ExternalLink,
  Calendar,
  Mail,
  RefreshCw,
  Link2,
  Target,
  TrendingUp,
} from "lucide-react";

interface ContentPiece {
  id: string;
  type: string;
  title: string;
  description: string;
  keyword: string;
  status: string;
  body: string | null;
  publishedUrl: string | null;
  publishedAt: string | null;
  scheduledPublishDate: string | null;
  dueDate: string | null;
  approval: { outcome: string; notes?: string } | null;
}

interface ContentPlan {
  id: string;
  month: number;
  year: number;
  title: string;
  seedKeyword: string;
  planStatus: string;
  planNotes: string | null;
  pieces: ContentPiece[];
}

export default function ContentHubPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedKeyword, setSeedKeyword] = useState("");
  const [blogCount, setBlogCount] = useState(0);
  const [gbpCount, setGbpCount] = useState(0);
  const [gbpQACount, setGbpQACount] = useState(0);
  const [prCount, setPrCount] = useState(0);
  const [clientTier, setClientTier] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"plan" | "generate" | "drafts" | "publishing">("plan");

  // Publishing modal
  const [publishingPiece, setPublishingPiece] = useState<ContentPiece | null>(null);
  const [pubUrl, setPubUrl] = useState("");
  const [pubDate, setPubDate] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  // Draft generation
  const [generatingPieceId, setGeneratingPieceId] = useState<string | null>(null);

  // Preview modal
  const [previewPiece, setPreviewPiece] = useState<ContentPiece | null>(null);

  // Approval flow
  const [isSendingApproval, setIsSendingApproval] = useState(false);
  const [approvalLink, setApprovalLink] = useState<string | null>(null);
  const [approvalMessage, setApprovalMessage] = useState("");

  // Plan approval flow
  const [isSendingPlanApproval, setIsSendingPlanApproval] = useState(false);
  const [planApprovalLink, setPlanApprovalLink] = useState<string | null>(null);

  // Client metadata for persistent review links
  const [clientAccessToken, setClientAccessToken] = useState<string | null>(null);
  const [clientContactEmail, setClientContactEmail] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");

  // Email preview modal
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewType, setEmailPreviewType] = useState<"plan" | "drafts">("plan");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  // Keyword suggestions for content generator
  interface KeywordSuggestion {
    keyword: string;
    searchVolume: number;
    competition: number;
    source: string; // "discovery" | "tracked" | "research"
  }
  const [keywordSuggestions, setKeywordSuggestions] = useState<KeywordSuggestion[]>([]);

  // Build client review URL from access token
  const getReviewUrl = (mode?: string) => {
    if (!clientAccessToken) return null;
    const base = `${window.location.origin}/client/${clientAccessToken}/content`;
    return mode ? `${base}?mode=${mode}` : base;
  };

  const loadData = () => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        setPlans(data.contentPlans || []);
        // Initialize generate form counts from client's tier capacity
        if (data.monthlyBlogs !== undefined) setBlogCount(data.monthlyBlogs);
        if (data.monthlyGbpPosts !== undefined) setGbpCount(data.monthlyGbpPosts);
        if (data.monthlyGbpQAs !== undefined) setGbpQACount(data.monthlyGbpQAs);
        if (data.monthlyPressReleases !== undefined) setPrCount(data.monthlyPressReleases);
        if (data.tier) setClientTier(data.tier);
        // Store client metadata for persistent review links
        if (data.accessToken) setClientAccessToken(data.accessToken);
        if (data.contactEmail) setClientContactEmail(data.contactEmail);
        if (data.name) setClientName(data.name);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // Fetch keyword suggestions from discovery + tracked keywords
    const fetchKeywordSuggestions = async () => {
      const suggestions: KeywordSuggestion[] = [];
      const seen = new Set<string>();

      // Fetch discovery keywords
      try {
        const res = await fetch(`/api/clients/${clientId}/discover`);
        if (res.ok) {
          const data = await res.json();
          if (data.latestResearch?.results) {
            try {
              const parsed = JSON.parse(data.latestResearch.results);
              for (const kw of parsed.slice(0, 30)) {
                const key = kw.keyword?.toLowerCase();
                if (key && !seen.has(key)) {
                  seen.add(key);
                  suggestions.push({
                    keyword: kw.keyword,
                    searchVolume: kw.searchVolume || 0,
                    competition: kw.competition || 0,
                    source: "discovery",
                  });
                }
              }
            } catch { /* */ }
          }
        }
      } catch { /* */ }

      // Fetch tracked keywords
      try {
        const res = await fetch(`/api/clients/${clientId}/keywords`);
        if (res.ok) {
          const data = await res.json();
          const kwList = data.keywords || data || [];
          for (const kw of kwList) {
            const key = kw.keyword?.toLowerCase();
            if (key && !seen.has(key)) {
              seen.add(key);
              suggestions.push({
                keyword: kw.keyword,
                searchVolume: kw.searchVolume || 0,
                competition: kw.difficulty || 0,
                source: "tracked",
              });
            }
          }
        }
      } catch { /* */ }

      // Fetch research sessions
      try {
        const res = await fetch(`/api/clients/${clientId}/research`);
        if (res.ok) {
          const sessions = await res.json();
          for (const session of sessions.slice(0, 3)) {
            for (const kw of (session.results || []).slice(0, 20)) {
              const key = kw.keyword?.toLowerCase();
              if (key && !seen.has(key)) {
                seen.add(key);
                suggestions.push({
                  keyword: kw.keyword,
                  searchVolume: kw.searchVolume || 0,
                  competition: kw.competition || 0,
                  source: "research",
                });
              }
            }
          }
        }
      } catch { /* */ }

      // Sort by volume descending
      suggestions.sort((a, b) => b.searchVolume - a.searchVolume);
      setKeywordSuggestions(suggestions);
    };
    fetchKeywordSuggestions();
  }, [clientId]);

  const plan = plans[0]; // Most recent plan

  const typeIcons: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    BLOG_POST: { icon: <FileText size={14} />, label: "Blog", color: "#3B82F6" },
    GBP_POST: { icon: <MapPin size={14} />, label: "GBP", color: "#10B981" },
    GBP_QA: { icon: <HelpCircle size={14} />, label: "Q&A", color: "#06B6D4" },
    PRESS_RELEASE: { icon: <Megaphone size={14} />, label: "PR", color: "#8B5CF6" },
  };

  const statusConfig: Record<string, { class: string; icon: React.ReactNode }> = {
    PLANNED: { class: "status-draft", icon: <Clock size={12} /> },
    WRITING: { class: "status-review", icon: <Edit3 size={12} /> },
    CLIENT_REVIEW: { class: "status-review", icon: <Eye size={12} /> },
    DRAFT_REVIEW: { class: "status-review", icon: <Eye size={12} /> },
    APPROVED: { class: "status-approved", icon: <CheckCircle2 size={12} /> },
    READY_TO_PUBLISH: { class: "status-approved", icon: <Send size={12} /> },
    PUBLISHED: { class: "status-published", icon: <CheckCircle2 size={12} /> },
    REJECTED: { class: "status-rejected", icon: <XCircle size={12} /> },
  };

  const planStatusColors: Record<string, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: "rgba(107,114,128,0.15)", text: "#9ca3af", label: "Draft" },
    PENDING_APPROVAL: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", label: "Pending Client Approval" },
    APPROVED: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", label: "Plan Approved" },
    REJECTED: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", label: "Plan Rejected" },
  };

  const handleGenerate = async () => {
    if (!seedKeyword.trim()) return;
    setIsGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          seedKeyword: seedKeyword.trim(),
          blogCount,
          gbpCount,
          gbpQACount,
          pressReleaseCount: prCount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate content plan");
        setIsGenerating(false);
        return;
      }

      // Refresh data and switch to plan tab
      setLoading(true);
      loadData();
      setActiveTab("plan");
      setSeedKeyword("");
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDraft = async (pieceId: string) => {
    setGeneratingPieceId(pieceId);

    try {
      const res = await fetch("/api/content/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentPieceId: pieceId }),
      });

      const data = await res.json();

      if (res.ok) {
        setPlans((prev) =>
          prev.map((p) => ({
            ...p,
            pieces: p.pieces.map((pc) =>
              pc.id === pieceId
                ? { ...pc, body: data.body, status: "CLIENT_REVIEW" }
                : pc
            ),
          }))
        );
      } else {
        setError(data.error || "Failed to generate draft");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setGeneratingPieceId(null);
    }
  };

  // Send PLAN for client approval (topics/titles only)
  const handleSendPlanForApproval = async () => {
    if (!plan) return;
    setIsSendingPlanApproval(true);
    setPlanApprovalLink(null);

    try {
      const res = await fetch("/api/content/send-plan-for-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, contentPlanId: plan.id }),
      });

      const data = await res.json();

      if (res.ok) {
        const url = `${window.location.origin}/client/${data.accessToken}/content?mode=plan`;
        setPlanApprovalLink(url);
        await navigator.clipboard.writeText(url);
        setLoading(true);
        loadData();
      } else {
        setError(data.error || "Failed to send plan for approval");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsSendingPlanApproval(false);
    }
  };

  // Open email preview modal
  const handleOpenEmailPreview = (type: "plan" | "drafts") => {
    setEmailPreviewType(type);
    if (type === "plan" && plan) {
      setEmailSubject(`📋 Content plan ready for your review — ${clientName}`);
      const reviewUrl = getReviewUrl("plan") || "";
      setEmailHtml(buildPlanEmailHtml(clientName, plan.title, plan.pieces.length, reviewUrl));
    } else {
      const draftCount = plan?.pieces.filter((p) => p.body).length || 0;
      setEmailSubject(`✍️ ${draftCount} content draft${draftCount !== 1 ? "s" : ""} ready for review — ${clientName}`);
      const reviewUrl = getReviewUrl() || "";
      setEmailHtml(buildDraftEmailHtml(clientName, draftCount, reviewUrl));
    }
    setResendSuccess(null);
    setShowEmailPreview(true);
  };

  // Resend email from preview
  const handleResendEmail = async () => {
    if (!clientContactEmail) {
      setError("No client email configured — update the client's contact email first.");
      return;
    }
    setIsResending(true);
    setResendSuccess(null);
    try {
      const res = await fetch("/api/content/resend-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: clientContactEmail,
          subject: emailSubject,
          html: emailHtml,
        }),
      });
      if (res.ok) {
        setResendSuccess(`Email sent to ${clientContactEmail}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send email");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsResending(false);
    }
  };

  // Send DRAFTS for client review (written content)
  const handleSendForApproval = async () => {
    if (!plan) return;
    setIsSendingApproval(true);
    setApprovalMessage("");
    setApprovalLink(null);

    try {
      const res = await fetch("/api/content/send-for-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, contentPlanId: plan.id }),
      });

      const data = await res.json();

      if (res.ok) {
        const url = `${window.location.origin}/client/${data.accessToken}/content`;
        setApprovalLink(url);
        setApprovalMessage(data.message);
        await navigator.clipboard.writeText(url);
        setLoading(true);
        loadData();
      } else {
        setError(data.error || "Failed to send for approval");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsSendingApproval(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  // Pieces with drafts (for the Drafts tab)
  const piecesWithDrafts = plan?.pieces.filter((p) => p.body) || [];
  const piecesWithoutDrafts = plan?.pieces.filter((p) => !p.body && (p.status === "PLANNED" || p.status === "APPROVED")) || [];

  const planApproved = plan?.planStatus === "APPROVED";
  const planPending = plan?.planStatus === "PENDING_APPROVAL";

  return (
    <div className="max-w-6xl">
      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab("plan")}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: activeTab === "plan" ? "var(--accent-muted)" : "transparent",
            color: activeTab === "plan" ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          <ClipboardList size={14} className="inline mr-2" />
          Content Plan
        </button>
        <button
          onClick={() => setActiveTab("generate")}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: activeTab === "generate" ? "var(--accent-muted)" : "transparent",
            color: activeTab === "generate" ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          <Sparkles size={14} className="inline mr-2" />
          AI Generator
        </button>
        <button
          onClick={() => setActiveTab("drafts")}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: activeTab === "drafts" ? "var(--accent-muted)" : "transparent",
            color: activeTab === "drafts" ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          <FileText size={14} className="inline mr-2" />
          Drafts
          {piecesWithDrafts.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(16,185,129,0.2)", color: "#10B981" }}>
              {piecesWithDrafts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("publishing")}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: activeTab === "publishing" ? "var(--accent-muted)" : "transparent",
            color: activeTab === "publishing" ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          <ExternalLink size={14} className="inline mr-2" />
          Publishing
          {plan && plan.pieces.filter((p) => p.status === "READY_TO_PUBLISH").length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(139,92,246,0.2)", color: "#8b5cf6" }}>
              {plan.pieces.filter((p) => p.status === "READY_TO_PUBLISH").length}
            </span>
          )}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg mb-4"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <AlertCircle size={16} style={{ color: "var(--danger)" }} />
          <p className="text-sm font-semibold flex-1" style={{ color: "var(--danger)" }}>
            {error}
          </p>
          <button onClick={() => setError("")} className="p-1">
            <X size={14} style={{ color: "var(--danger)" }} />
          </button>
        </div>
      )}

      {/* ═══ AI GENERATOR TAB ═══ */}
      {activeTab === "generate" && (
        <div className="animate-fade-in">
          <div className="stat-card mb-6" style={{ padding: 24 }}>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold">Topical Content Generator</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Powered by Claude AI — generates complete content plans from a seed keyword
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                  Seed Keyword
                </label>
                <input
                  className="input-field"
                  placeholder="Select below or type your own"
                  value={seedKeyword}
                  onChange={(e) => setSeedKeyword(e.target.value)}
                />
                {/* Keyword Suggestions */}
                {keywordSuggestions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                      <Target size={10} className="inline mr-1" />
                      Suggested Keywords
                    </p>
                    <div className="flex flex-wrap gap-1.5" style={{ maxHeight: 160, overflowY: "auto" }}>
                      {keywordSuggestions.slice(0, 20).map((kw, i) => (
                        <button
                          key={kw.keyword}
                          onClick={() => setSeedKeyword(kw.keyword)}
                          className="text-[10px] font-semibold px-2 py-1 rounded-md transition-all hover:opacity-80 flex items-center gap-1"
                          style={{
                            background: seedKeyword === kw.keyword
                              ? "var(--accent)"
                              : i < 3 ? "rgba(16,185,129,0.15)" : "var(--accent-muted)",
                            color: seedKeyword === kw.keyword
                              ? "#fff"
                              : i < 3 ? "#10B981" : "var(--accent)",
                            border: seedKeyword === kw.keyword ? "1px solid var(--accent)" : "1px solid transparent",
                          }}
                          title={`${kw.searchVolume.toLocaleString()} monthly searches · ${kw.source}`}
                        >
                          {i < 3 && <TrendingUp size={8} />}
                          {kw.keyword}
                          <span style={{ opacity: 0.6 }}>{kw.searchVolume > 0 ? `(${kw.searchVolume.toLocaleString()})` : ""}</span>
                        </button>
                      ))}
                    </div>
                    {keywordSuggestions.length > 20 && (
                      <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>
                        +{keywordSuggestions.length - 20} more in Keyword Research
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                  Blog Posts
                </label>
                <input className="input-field" type="number" min={0} max={20} value={blogCount} onChange={(e) => setBlogCount(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                  GBP Posts
                </label>
                <input className="input-field" type="number" min={0} max={30} value={gbpCount} onChange={(e) => setGbpCount(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                  GBP Q&As
                </label>
                <input className="input-field" type="number" min={0} max={20} value={gbpQACount} onChange={(e) => setGbpQACount(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                  Press Releases
                </label>
                <input className="input-field" type="number" min={0} max={10} value={prCount} onChange={(e) => setPrCount(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !seedKeyword.trim()}
              className="btn-primary mt-4"
              style={{ opacity: !seedKeyword.trim() ? 0.5 : 1 }}
            >
              {isGenerating ? (
                <><Loader2 size={16} className="animate-spin" /> Generating Plan...</>
              ) : (
                <><Sparkles size={16} /> Generate Content Plan</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══ CONTENT PLAN TAB ═══ */}
      {activeTab === "plan" && plan && (
        <div className="animate-fade-in">
          {/* Plan header with status */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-extrabold">{plan.title}</h2>
                {/* Plan status badge */}
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{
                    background: (planStatusColors[plan.planStatus] || planStatusColors.DRAFT).bg,
                    color: (planStatusColors[plan.planStatus] || planStatusColors.DRAFT).text,
                  }}
                >
                  {(planStatusColors[plan.planStatus] || planStatusColors.DRAFT).label}
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {plan.pieces.length} topics planned ·{" "}
                {plan.pieces.filter((p) => p.type === "BLOG_POST").length} blog posts ·{" "}
                {plan.pieces.filter((p) => p.type === "GBP_POST").length} GBP posts ·{" "}
                {plan.pieces.filter((p) => p.type === "GBP_QA").length} Q&As ·{" "}
                {plan.pieces.filter((p) => p.type === "PRESS_RELEASE").length} press releases
              </p>
            </div>
            {/* Send Plan for Approval (only if DRAFT) */}
            {plan.planStatus === "DRAFT" && (
              <button
                onClick={handleSendPlanForApproval}
                disabled={isSendingPlanApproval}
                className="btn-primary text-sm"
              >
                {isSendingPlanApproval ? (
                  <><Loader2 size={14} className="animate-spin" /> Sending...</>
                ) : (
                  <><Send size={14} /> Send Plan for Approval</>
                )}
              </button>
            )}
          </div>

          {/* Plan approval link toast (one-time after sending) */}
          {planApprovalLink && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl mb-4"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
              }}
            >
              <CheckCircle2 size={18} style={{ color: "var(--success)" }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: "var(--success)" }}>
                  Content plan sent for client approval — link copied!
                </p>
                <p className="text-xs truncate mt-1" style={{ color: "var(--text-muted)" }}>
                  {planApprovalLink}
                </p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(planApprovalLink)}
                className="btn-secondary text-xs flex-shrink-0"
                style={{ padding: "4px 10px" }}
              >
                <Copy size={12} /> Copy
              </button>
              <button onClick={() => setPlanApprovalLink(null)} className="p-1 flex-shrink-0">
                <X size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
          )}

          {/* Plan rejected notes */}
          {plan.planStatus === "REJECTED" && plan.planNotes && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-4"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <XCircle size={18} style={{ color: "#ef4444" }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold" style={{ color: "#ef4444" }}>Client Rejected Plan</p>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{plan.planNotes}</p>
              </div>
            </div>
          )}

          {/* ── Persistent Review Link Bar (PENDING_APPROVAL) ── */}
          {planPending && (
            <div
              className="rounded-xl mb-4 overflow-hidden"
              style={{
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.2)",
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <Clock size={18} style={{ color: "#f59e0b" }} className="flex-shrink-0" />
                <p className="text-sm font-semibold flex-1" style={{ color: "#f59e0b" }}>
                  Waiting for client to review and approve this content plan…
                </p>
              </div>
              {/* Persistent client review link */}
              {clientAccessToken && (
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid rgba(245,158,11,0.12)", background: "rgba(245,158,11,0.03)" }}>
                  <Link2 size={14} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                  <p className="text-xs truncate flex-1 font-mono" style={{ color: "var(--text-muted)" }}>
                    {getReviewUrl("plan")}
                  </p>
                  <button
                    onClick={() => { const url = getReviewUrl("plan"); if (url) navigator.clipboard.writeText(url); }}
                    className="btn-secondary text-xs flex-shrink-0"
                    style={{ padding: "4px 10px" }}
                  >
                    <Copy size={12} /> Copy Link
                  </button>
                  <button
                    onClick={() => { const url = getReviewUrl("plan"); if (url) window.open(url, "_blank"); }}
                    className="btn-secondary text-xs flex-shrink-0"
                    style={{ padding: "4px 10px" }}
                  >
                    <Eye size={12} /> Preview
                  </button>
                  <button
                    onClick={() => handleOpenEmailPreview("plan")}
                    className="btn-secondary text-xs flex-shrink-0"
                    style={{ padding: "4px 10px" }}
                  >
                    <Mail size={12} /> Email Preview
                  </button>
                  <button
                    onClick={() => handleOpenEmailPreview("plan")}
                    className="btn-secondary text-xs flex-shrink-0"
                    style={{ padding: "4px 10px", color: "#f59e0b" }}
                  >
                    <RefreshCw size={12} /> Resend
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Plan approved info */}
          {planApproved && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl mb-4"
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
            >
              <CheckCircle2 size={18} style={{ color: "#22c55e" }} className="flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: "#22c55e" }}>
                  ✅ Plan approved by client! Switch to the Drafts tab to generate written content.
                </p>
              </div>
              <button onClick={() => setActiveTab("drafts")} className="btn-primary text-xs" style={{ padding: "6px 14px" }}>
                Go to Drafts →
              </button>
            </div>
          )}

          {/* Content pieces grid — topics/titles only (no draft actions here) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
            {plan.pieces.map((piece) => {
              const typeInfo = typeIcons[piece.type] || typeIcons.BLOG_POST;

              return (
                <div key={piece.id} className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
                  <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: `${typeInfo.color}20`, color: typeInfo.color }}
                      >
                        {typeInfo.icon}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: typeInfo.color }}>
                        {typeInfo.label}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h4 className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      {piece.title}
                    </h4>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
                      {piece.description}
                    </p>
                    <span
                      className="text-[10px] font-bold uppercase px-2 py-1 rounded-md"
                      style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}
                    >
                      🎯 {piece.keyword}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "plan" && !plan && (
        <div className="stat-card flex flex-col items-center justify-center py-16 text-center">
          <Sparkles size={40} style={{ color: "var(--text-muted)" }} className="mb-4" />
          <h3 className="text-lg font-bold mb-2">No Content Plan Yet</h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Switch to the AI Generator tab to create a content plan from a seed keyword.
          </p>
          <button onClick={() => setActiveTab("generate")} className="btn-primary">
            <Sparkles size={16} /> Generate Content Plan
          </button>
        </div>
      )}

      {/* ═══ DRAFTS TAB ═══ */}
      {activeTab === "drafts" && plan && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-extrabold">Drafts & Content</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {piecesWithDrafts.length} drafted · {piecesWithoutDrafts.length} awaiting draft
              </p>
            </div>
            {/* Send drafts for review — only when drafts exist */}
            <button
              onClick={handleSendForApproval}
              disabled={isSendingApproval || piecesWithDrafts.length === 0}
              className="btn-primary text-sm"
              style={{ opacity: piecesWithDrafts.length === 0 ? 0.4 : 1 }}
              title={piecesWithDrafts.length === 0 ? "Generate at least one draft first" : "Send written drafts for client review"}
            >
              {isSendingApproval ? (
                <><Loader2 size={14} className="animate-spin" /> Sending...</>
              ) : (
                <><Send size={14} /> Send Drafts for Review</>
              )}
            </button>
          </div>

          {/* Draft approval link toast (one-time after sending) */}
          {approvalLink && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl mb-4"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
              }}
            >
              <CheckCircle2 size={18} style={{ color: "var(--success)" }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: "var(--success)" }}>
                  {approvalMessage} — link copied to clipboard!
                </p>
                <p className="text-xs truncate mt-1" style={{ color: "var(--text-muted)" }}>
                  {approvalLink}
                </p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(approvalLink)}
                className="btn-secondary text-xs flex-shrink-0"
                style={{ padding: "4px 10px" }}
              >
                <Copy size={12} /> Copy
              </button>
              <button onClick={() => { setApprovalLink(null); setApprovalMessage(""); }} className="p-1 flex-shrink-0">
                <X size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
          )}

          {/* ── Persistent Draft Review Link Bar ── */}
          {plan.pieces.some((p) => p.status === "CLIENT_REVIEW" || p.status === "DRAFT_REVIEW") && clientAccessToken && !approvalLink && (
            <div
              className="rounded-xl mb-4 overflow-hidden"
              style={{
                background: "rgba(16,185,129,0.06)",
                border: "1px solid rgba(16,185,129,0.2)",
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <Eye size={16} style={{ color: "#10b981" }} className="flex-shrink-0" />
                <p className="text-sm font-semibold flex-1" style={{ color: "#10b981" }}>
                  Drafts sent for client review
                  {clientContactEmail && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {clientContactEmail}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid rgba(16,185,129,0.12)", background: "rgba(16,185,129,0.03)" }}>
                <Link2 size={14} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                <p className="text-xs truncate flex-1 font-mono" style={{ color: "var(--text-muted)" }}>
                  {getReviewUrl()}
                </p>
                <button
                  onClick={() => { const url = getReviewUrl(); if (url) navigator.clipboard.writeText(url); }}
                  className="btn-secondary text-xs flex-shrink-0"
                  style={{ padding: "4px 10px" }}
                >
                  <Copy size={12} /> Copy Link
                </button>
                <button
                  onClick={() => { const url = getReviewUrl(); if (url) window.open(url, "_blank"); }}
                  className="btn-secondary text-xs flex-shrink-0"
                  style={{ padding: "4px 10px" }}
                >
                  <Eye size={12} /> Preview
                </button>
                <button
                  onClick={() => handleOpenEmailPreview("drafts")}
                  className="btn-secondary text-xs flex-shrink-0"
                  style={{ padding: "4px 10px" }}
                >
                  <Mail size={12} /> Email Preview
                </button>
                <button
                  onClick={() => handleOpenEmailPreview("drafts")}
                  className="btn-secondary text-xs flex-shrink-0"
                  style={{ padding: "4px 10px", color: "#10b981" }}
                >
                  <RefreshCw size={12} /> Resend
                </button>
              </div>
            </div>
          )}

          {/* Not approved warning */}
          {!planApproved && plan.planStatus !== "DRAFT" && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl mb-4"
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.2)",
              }}
            >
              <AlertCircle size={18} style={{ color: "#f59e0b" }} className="flex-shrink-0" />
              <p className="text-sm" style={{ color: "#f59e0b" }}>
                The content plan hasn&apos;t been approved yet. You can still generate drafts, but it&apos;s recommended to wait for client plan approval first.
              </p>
            </div>
          )}

          {/* All pieces — with draft actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
            {plan.pieces.map((piece) => {
              const typeInfo = typeIcons[piece.type] || typeIcons.BLOG_POST;
              const statusInfo = statusConfig[piece.status] || statusConfig.PLANNED;
              const isGeneratingThis = generatingPieceId === piece.id;
              const hasDraft = !!piece.body;

              return (
                <div key={piece.id} className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
                  <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: `${typeInfo.color}20`, color: typeInfo.color }}
                      >
                        {typeInfo.icon}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: typeInfo.color }}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <span className={`status-badge ${statusInfo.class}`}>
                      {statusInfo.icon}
                      <span className="ml-1">{piece.status.replace("_", " ")}</span>
                    </span>
                  </div>
                  <div className="p-4">
                    <h4 className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      {piece.title}
                    </h4>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
                      {piece.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-1 rounded-md"
                        style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}
                      >
                        🎯 {piece.keyword}
                      </span>
                      {hasDraft && (
                        <span
                          className="text-[10px] font-bold uppercase px-2 py-1 rounded-md"
                          style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}
                        >
                          ✍️ Draft Ready
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="px-4 py-3 flex gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                    {!hasDraft && (piece.status === "APPROVED" || piece.status === "PLANNED") && (
                      <button
                        onClick={() => handleGenerateDraft(piece.id)}
                        disabled={isGeneratingThis}
                        className="btn-primary text-xs flex-1"
                        style={{ padding: "6px 12px" }}
                      >
                        {isGeneratingThis ? (
                          <><Loader2 size={12} className="animate-spin" /> Writing...</>
                        ) : (
                          <><Sparkles size={12} /> Generate Draft</>
                        )}
                      </button>
                    )}
                    {hasDraft && (
                      <button
                        onClick={() => handleGenerateDraft(piece.id)}
                        disabled={isGeneratingThis}
                        className="btn-secondary text-xs"
                        style={{ padding: "6px 12px" }}
                      >
                        {isGeneratingThis ? (
                          <><Loader2 size={12} className="animate-spin" /> Rewriting...</>
                        ) : (
                          <><Sparkles size={12} /> Regenerate</>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setPreviewPiece(piece)}
                      disabled={!hasDraft}
                      className="btn-secondary text-xs"
                      style={{ padding: "6px 12px", opacity: hasDraft ? 1 : 0.4 }}
                      title={hasDraft ? "Preview draft" : "Generate a draft first"}
                    >
                      <Eye size={12} />
                      Preview
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "drafts" && !plan && (
        <div className="stat-card flex flex-col items-center justify-center py-16 text-center">
          <FileText size={40} style={{ color: "var(--text-muted)" }} className="mb-4" />
          <h3 className="text-lg font-bold mb-2">No Content Plan Yet</h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Create a content plan first, then generate drafts from it.
          </p>
          <button onClick={() => setActiveTab("generate")} className="btn-primary">
            <Sparkles size={16} /> Generate Content Plan
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {previewPiece && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewPiece(null);
          }}
        >
          <div
            className="stat-card w-full max-w-3xl mx-4 animate-fade-in"
            style={{ padding: 0, maxHeight: "85vh", display: "flex", flexDirection: "column" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `${(typeIcons[previewPiece.type] || typeIcons.BLOG_POST).color}20`,
                    color: (typeIcons[previewPiece.type] || typeIcons.BLOG_POST).color,
                  }}
                >
                  {(typeIcons[previewPiece.type] || typeIcons.BLOG_POST).icon}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold truncate">{previewPiece.title}</h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    🎯 {previewPiece.keyword} · {(typeIcons[previewPiece.type] || typeIcons.BLOG_POST).label}
                  </p>
                </div>
              </div>
              <button onClick={() => setPreviewPiece(null)} className="p-2 rounded-lg hover:bg-white/5 flex-shrink-0">
                <X size={20} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
            {/* Content */}
            <div
              className="px-6 py-5 overflow-y-auto flex-1 prose-preview"
              style={{ color: "var(--text-primary)", fontSize: 14, lineHeight: 1.75 }}
            >
              {previewPiece.body ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: simpleMarkdownToHtml(previewPiece.body),
                  }}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No draft generated yet. Click &quot;Generate Draft&quot; to create one.
                  </p>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="flex gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => {
                  if (previewPiece.body) {
                    navigator.clipboard.writeText(previewPiece.body);
                  }
                }}
                className="btn-secondary text-sm"
              >
                📋 Copy Markdown
              </button>
              <button
                onClick={() => {
                  handleGenerateDraft(previewPiece.id);
                  setPreviewPiece(null);
                }}
                className="btn-secondary text-sm"
              >
                <Sparkles size={14} /> Regenerate
              </button>
              <div className="flex-1" />
              <button onClick={() => setPreviewPiece(null)} className="btn-primary text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PUBLISHING TAB ═══════════ */}
      {activeTab === "publishing" && plan && (() => {
        const readyPieces = plan.pieces.filter((p) => p.status === "READY_TO_PUBLISH");
        const publishedPieces = plan.pieces.filter((p) => p.status === "PUBLISHED");
        const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
          BLOG_POST: { icon: <FileText size={12} />, label: "Blog", color: "#3B82F6" },
          GBP_POST: { icon: <MapPin size={12} />, label: "GBP", color: "#10B981" },
          GBP_QA: { icon: <HelpCircle size={12} />, label: "Q&A", color: "#06B6D4" },
          PRESS_RELEASE: { icon: <Megaphone size={12} />, label: "PR", color: "#8B5CF6" },
        };

        const handleMarkPublished = async () => {
          if (!publishingPiece) return;
          setIsPublishing(true);
          try {
            const res = await fetch(`/api/content/pieces/${publishingPiece.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "PUBLISHED",
                publishedUrl: pubUrl || null,
                publishedAt: pubDate || new Date().toISOString(),
              }),
            });
            if (res.ok) {
              loadData();
              setPublishingPiece(null);
              setPubUrl("");
              setPubDate("");
            }
          } catch { /* silently fail */ } finally {
            setIsPublishing(false);
          }
        };

        return (
          <div className="stagger">
            {/* Ready to Publish */}
            <div className="mb-8">
              <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
                <Send size={18} style={{ color: "#8b5cf6" }} />
                Ready to Publish
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>
                  {readyPieces.length}
                </span>
              </h3>
              {readyPieces.length === 0 ? (
                <div className="stat-card text-center py-10">
                  <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                    No pieces waiting to be published
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Approved drafts will appear here
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {readyPieces.map((piece) => {
                    const tc = typeConfig[piece.type] || typeConfig.BLOG_POST;
                    return (
                      <div key={piece.id} className="stat-card" style={{ padding: 0 }}>
                        <div className="flex items-center gap-4 p-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase" style={{ background: `${tc.color}20`, color: tc.color }}>
                                {tc.icon} {tc.label}
                              </span>
                              {piece.keyword && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>
                                  🎯 {piece.keyword}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                              {piece.title}
                            </h4>
                            {piece.description && (
                              <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                                {piece.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setPublishingPiece(piece);
                              setPubDate(new Date().toISOString().split("T")[0]);
                            }}
                            className="btn-primary text-xs whitespace-nowrap"
                          >
                            <ExternalLink size={14} />
                            Mark Published
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Published Log */}
            <div>
              <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
                <CheckCircle2 size={18} style={{ color: "#10b981" }} />
                Published Content
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                  {publishedPieces.length}
                </span>
              </h3>
              {publishedPieces.length === 0 ? (
                <div className="stat-card text-center py-10">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No published content yet</p>
                </div>
              ) : (
                <div className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Published</th>
                        <th>URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {publishedPieces.map((piece) => {
                        const tc = typeConfig[piece.type] || typeConfig.BLOG_POST;
                        return (
                          <tr key={piece.id}>
                            <td>
                              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                                {piece.title}
                              </span>
                            </td>
                            <td>
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase w-fit" style={{ background: `${tc.color}20`, color: tc.color }}>
                                {tc.icon} {tc.label}
                              </span>
                            </td>
                            <td>
                              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                                {piece.publishedAt ? new Date(piece.publishedAt).toLocaleDateString() : "—"}
                              </span>
                            </td>
                            <td>
                              {piece.publishedUrl ? (
                                <a href={piece.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--accent)" }}>
                                  <ExternalLink size={10} /> View
                                </a>
                              ) : (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Publish Modal */}
            {publishingPiece && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={(e) => { if (e.target === e.currentTarget) setPublishingPiece(null); }}>
                <div className="stat-card w-full max-w-md mx-4 animate-fade-in" style={{ padding: 24 }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-extrabold flex items-center gap-2">
                      <ExternalLink size={20} style={{ color: "var(--success)" }} />
                      Mark as Published
                    </h3>
                    <button onClick={() => setPublishingPiece(null)} className="p-1 rounded-lg hover:bg-white/5">
                      <X size={20} style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>
                  <div className="p-3 rounded-xl mb-4" style={{ background: "var(--bg-card-hover)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{publishingPiece.title}</p>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>Published URL (optional)</label>
                    <input className="input-field" placeholder="https://example.com/blog/article" value={pubUrl} onChange={(e) => setPubUrl(e.target.value)} />
                  </div>
                  <div className="mb-6">
                    <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                      <Calendar size={12} className="inline mr-1" /> Publish Date
                    </label>
                    <input type="date" className="input-field" value={pubDate} onChange={(e) => setPubDate(e.target.value)} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleMarkPublished} disabled={isPublishing} className="btn-primary flex-1">
                      {isPublishing ? <><Loader2 size={16} className="animate-spin" /> Publishing...</> : <><CheckCircle2 size={16} /> Confirm Published</>}
                    </button>
                    <button onClick={() => setPublishingPiece(null)} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ EMAIL PREVIEW MODAL ═══ */}
      {showEmailPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEmailPreview(false); }}
        >
          <div
            className="stat-card w-full max-w-2xl mx-4 animate-fade-in"
            style={{ padding: 0, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(124,58,237,0.15)", color: "#7c3aed" }}
                >
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold">Email Preview</h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {emailPreviewType === "plan" ? "Plan Approval" : "Draft Review"} · {clientContactEmail || "No email configured"}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowEmailPreview(false)} className="p-2 rounded-lg hover:bg-white/5">
                <X size={20} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {/* Subject line (editable) */}
            <div className="px-6 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card-hover)" }}>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: "var(--text-muted)" }}>
                Subject Line
              </label>
              <input
                className="input-field text-sm"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
              />
            </div>

            {/* Email HTML preview */}
            <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: "#1a1b23" }}>
              <div
                style={{
                  maxWidth: 560,
                  margin: "0 auto",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
                dangerouslySetInnerHTML={{ __html: emailHtml }}
              />
            </div>

            {/* Footer with actions */}
            <div className="px-6 py-4 flex items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
              {resendSuccess && (
                <div className="flex items-center gap-2 flex-1">
                  <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
                  <span className="text-xs font-bold" style={{ color: "#22c55e" }}>{resendSuccess}</span>
                </div>
              )}
              {!resendSuccess && (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {clientContactEmail ? `Will send to: ${clientContactEmail}` : "⚠️ No client email configured"}
                  </span>
                </div>
              )}
              <button
                onClick={handleResendEmail}
                disabled={isResending || !clientContactEmail}
                className="btn-primary text-sm"
                style={{ opacity: clientContactEmail ? 1 : 0.4 }}
              >
                {isResending ? (
                  <><Loader2 size={14} className="animate-spin" /> Sending...</>
                ) : (
                  <><Send size={14} /> {resendSuccess ? "Send Again" : "Send Email"}</>
                )}
              </button>
              <button onClick={() => setShowEmailPreview(false)} className="btn-secondary text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Simple Markdown → HTML converter for preview (no external deps) */
function simpleMarkdownToHtml(md: string): string {
  let html = md
    // Headings
    .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:800;margin:20px 0 8px;color:var(--text-primary)">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:800;margin:24px 0 10px;color:var(--text-primary)">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:800;margin:0 0 16px;color:var(--text-primary)">$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li style="margin-left:20px;margin-bottom:4px">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:20px;margin-bottom:4px;list-style:decimal">$1</li>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent);padding-left:16px;margin:12px 0;color:var(--text-muted);font-style:italic">$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />')
    // Line breaks → paragraphs
    .replace(/\n\n/g, '</p><p style="margin-bottom:12px">')
    .replace(/\n/g, '<br />');

  html = `<p style="margin-bottom:12px">${html}</p>`;
  return html;
}

/** Build the plan approval email HTML (client-side mirror of server template) */
function buildPlanEmailHtml(clientName: string, planTitle: string, pieceCount: number, reviewUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f1117; color: #e4e4e7; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: rgba(124,58,237,0.15); border-radius: 12px; line-height: 48px; font-size: 24px;">📋</div>
      </div>
      <h1 style="font-size: 22px; font-weight: 800; text-align: center; margin: 0 0 8px;">Content Plan Ready</h1>
      <p style="font-size: 14px; color: #a1a1aa; text-align: center; margin: 0 0 24px;">
        ${clientName} · ${planTitle}
      </p>
      <div style="background: #1a1b23; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="text-align: center;">
          <div style="font-size: 28px; font-weight: 800; color: #7c3aed;">${pieceCount}</div>
          <div style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Content Pieces</div>
        </div>
      </div>
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 13px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px;">What To Do</h3>
        <div style="font-size: 14px; line-height: 2;">
          1. Review each content topic and description<br>
          2. Approve topics you'd like us to write<br>
          3. Reject or request changes on any that don't fit<br>
          4. We'll start drafting once you approve
        </div>
      </div>
      <div style="text-align: center;">
        <a href="${reviewUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">
          Review Content Plan →
        </a>
      </div>
      <p style="font-size: 11px; color: #52525b; text-align: center; margin-top: 24px;">
        KNGO SEO Platform · KangoMedia
      </p>
    </div>
  `;
}

/** Build the draft review email HTML (client-side mirror of server template) */
function buildDraftEmailHtml(clientName: string, pieceCount: number, reviewUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f1117; color: #e4e4e7; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: rgba(16,185,129,0.15); border-radius: 12px; line-height: 48px; font-size: 24px;">✍️</div>
      </div>
      <h1 style="font-size: 22px; font-weight: 800; text-align: center; margin: 0 0 8px;">Content Drafts Ready</h1>
      <p style="font-size: 14px; color: #a1a1aa; text-align: center; margin: 0 0 24px;">
        ${clientName}
      </p>
      <div style="background: #1a1b23; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="text-align: center;">
          <div style="font-size: 28px; font-weight: 800; color: #10b981;">${pieceCount}</div>
          <div style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Drafts For Review</div>
        </div>
      </div>
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 13px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px;">What To Do</h3>
        <div style="font-size: 14px; line-height: 2;">
          1. Read each content draft carefully<br>
          2. Approve drafts that are ready to publish<br>
          3. Request revisions with specific feedback<br>
          4. Approved drafts will be scheduled for publishing
        </div>
      </div>
      <div style="text-align: center;">
        <a href="${reviewUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">
          Review Drafts →
        </a>
      </div>
      <p style="font-size: 11px; color: #52525b; text-align: center; margin-top: 24px;">
        KNGO SEO Platform · KangoMedia
      </p>
    </div>
  `;
}
