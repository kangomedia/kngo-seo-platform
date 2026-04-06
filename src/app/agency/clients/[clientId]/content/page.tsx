"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Sparkles,
  FileText,
  MapPin,
  Megaphone,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ContentPlan {
  id: string;
  month: number;
  year: number;
  title: string;
  pieces: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    keyword: string;
    status: string;
    approval: { outcome: string; notes?: string } | null;
  }>;
}

export default function ContentHubPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedKeyword, setSeedKeyword] = useState("");
  const [blogCount, setBlogCount] = useState(4);
  const [gbpCount, setGbpCount] = useState(8);
  const [prCount, setPrCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"plan" | "generate">("plan");

  const loadData = () => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        setPlans(data.contentPlans || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [clientId]);

  const plan = plans[0]; // Most recent plan

  const typeIcons: Record<
    string,
    { icon: React.ReactNode; label: string; color: string }
  > = {
    BLOG_POST: {
      icon: <FileText size={14} />,
      label: "Blog",
      color: "#3B82F6",
    },
    GBP_POST: {
      icon: <MapPin size={14} />,
      label: "GBP",
      color: "#10B981",
    },
    PRESS_RELEASE: {
      icon: <Megaphone size={14} />,
      label: "PR",
      color: "#8B5CF6",
    },
  };

  const statusConfig: Record<
    string,
    { class: string; icon: React.ReactNode }
  > = {
    PLANNED: { class: "status-draft", icon: <Clock size={12} /> },
    CLIENT_REVIEW: { class: "status-review", icon: <Eye size={12} /> },
    APPROVED: {
      class: "status-approved",
      icon: <CheckCircle2 size={12} />,
    },
    WRITING: { class: "status-review", icon: <Edit3 size={12} /> },
    PUBLISHED: {
      class: "status-published",
      icon: <CheckCircle2 size={12} />,
    },
    REJECTED: { class: "status-rejected", icon: <XCircle size={12} /> },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2
          size={24}
          className="animate-spin"
          style={{ color: "var(--accent)" }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab("plan")}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background:
              activeTab === "plan"
                ? "var(--accent-muted)"
                : "transparent",
            color:
              activeTab === "plan"
                ? "var(--accent)"
                : "var(--text-muted)",
          }}
        >
          <FileText size={14} className="inline mr-2" />
          Content Plan
        </button>
        <button
          onClick={() => setActiveTab("generate")}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background:
              activeTab === "generate"
                ? "var(--accent-muted)"
                : "transparent",
            color:
              activeTab === "generate"
                ? "var(--accent)"
                : "var(--text-muted)",
          }}
        >
          <Sparkles size={14} className="inline mr-2" />
          AI Generator
        </button>
      </div>

      {activeTab === "generate" && (
        <div className="animate-fade-in">
          <div className="stat-card mb-6" style={{ padding: 24 }}>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                }}
              >
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold">
                  Topical Content Generator
                </h3>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Powered by Claude AI — generates complete content plans
                  from a seed keyword
                </p>
              </div>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg mb-4"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <AlertCircle
                  size={16}
                  style={{ color: "var(--danger)" }}
                />
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--danger)" }}
                >
                  {error}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label
                  className="text-xs font-bold uppercase tracking-wide mb-2 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Seed Keyword
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. ac repair denver"
                  value={seedKeyword}
                  onChange={(e) => setSeedKeyword(e.target.value)}
                />
              </div>
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wide mb-2 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Blog Posts
                </label>
                <input
                  className="input-field"
                  type="number"
                  min={0}
                  max={20}
                  value={blogCount}
                  onChange={(e) =>
                    setBlogCount(parseInt(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wide mb-2 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  GBP Posts
                </label>
                <input
                  className="input-field"
                  type="number"
                  min={0}
                  max={30}
                  value={gbpCount}
                  onChange={(e) =>
                    setGbpCount(parseInt(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wide mb-2 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Press Releases
                </label>
                <input
                  className="input-field"
                  type="number"
                  min={0}
                  max={10}
                  value={prCount}
                  onChange={(e) =>
                    setPrCount(parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !seedKeyword.trim()}
              className="btn-primary mt-4"
              style={{
                opacity: !seedKeyword.trim() ? 0.5 : 1,
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Content Plan
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === "plan" && plan && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-extrabold">{plan.title}</h2>
              <p
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {plan.pieces.length} pieces ·{" "}
                {
                  plan.pieces.filter((p) => p.status === "PUBLISHED")
                    .length
                }{" "}
                published
              </p>
            </div>
            <button className="btn-secondary text-sm">
              <Send size={14} />
              Send for Approval
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
            {plan.pieces.map((piece) => {
              const typeInfo =
                typeIcons[piece.type] || typeIcons.BLOG_POST;
              const statusInfo =
                statusConfig[piece.status] || statusConfig.PLANNED;

              return (
                <div
                  key={piece.id}
                  className="stat-card"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  <div
                    className="px-4 py-2 flex items-center justify-between"
                    style={{
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{
                          background: `${typeInfo.color}20`,
                          color: typeInfo.color,
                        }}
                      >
                        {typeInfo.icon}
                      </span>
                      <span
                        className="text-xs font-bold uppercase tracking-wide"
                        style={{ color: typeInfo.color }}
                      >
                        {typeInfo.label}
                      </span>
                    </div>
                    <span
                      className={`status-badge ${statusInfo.class}`}
                    >
                      {statusInfo.icon}
                      <span className="ml-1">
                        {piece.status.replace("_", " ")}
                      </span>
                    </span>
                  </div>
                  <div className="p-4">
                    <h4
                      className="text-sm font-bold mb-2"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {piece.title}
                    </h4>
                    <p
                      className="text-xs leading-relaxed mb-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {piece.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-1 rounded-md"
                        style={{
                          background: "var(--bg-card-hover)",
                          color: "var(--text-muted)",
                        }}
                      >
                        🎯 {piece.keyword}
                      </span>
                    </div>
                  </div>
                  <div
                    className="px-4 py-3 flex gap-2"
                    style={{
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    {(piece.status === "APPROVED" ||
                      piece.status === "PLANNED") && (
                      <button
                        className="btn-primary text-xs flex-1"
                        style={{ padding: "6px 12px" }}
                      >
                        <Sparkles size={12} />
                        Generate Draft
                      </button>
                    )}
                    <button
                      className="btn-secondary text-xs"
                      style={{ padding: "6px 12px" }}
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

      {activeTab === "plan" && !plan && (
        <div className="stat-card flex flex-col items-center justify-center py-16 text-center">
          <Sparkles
            size={40}
            style={{ color: "var(--text-muted)" }}
            className="mb-4"
          />
          <h3 className="text-lg font-bold mb-2">No Content Plan Yet</h3>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Switch to the AI Generator tab to create a content plan from a
            seed keyword.
          </p>
          <button
            onClick={() => setActiveTab("generate")}
            className="btn-primary"
          >
            <Sparkles size={16} />
            Generate Content Plan
          </button>
        </div>
      )}
    </div>
  );
}
