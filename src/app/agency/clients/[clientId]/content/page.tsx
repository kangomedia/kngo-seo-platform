"use client";

import { useParams } from "next/navigation";
import { contentPlansByClient, clients } from "@/lib/mock-data";
import { useState } from "react";
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
  ChevronDown,
  Loader2,
} from "lucide-react";

export default function ContentHubPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const client = clients.find((c) => c.id === clientId);
  const plan = contentPlansByClient[clientId];
  const [seedKeyword, setSeedKeyword] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"plan" | "generate">("plan");

  const typeIcons: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    BLOG_POST: { icon: <FileText size={14} />, label: "Blog", color: "#3B82F6" },
    GBP_POST: { icon: <MapPin size={14} />, label: "GBP", color: "#10B981" },
    PRESS_RELEASE: { icon: <Megaphone size={14} />, label: "PR", color: "#8B5CF6" },
  };

  const statusConfig: Record<string, { class: string; icon: React.ReactNode }> = {
    PLANNED: { class: "status-draft", icon: <Clock size={12} /> },
    CLIENT_REVIEW: { class: "status-review", icon: <Eye size={12} /> },
    APPROVED: { class: "status-approved", icon: <CheckCircle2 size={12} /> },
    WRITING: { class: "status-review", icon: <Edit3 size={12} /> },
    PUBLISHED: { class: "status-published", icon: <CheckCircle2 size={12} /> },
    REJECTED: { class: "status-rejected", icon: <XCircle size={12} /> },
  };

  const handleGenerate = () => {
    if (!seedKeyword.trim()) return;
    setIsGenerating(true);
    // In production: call generateTopicalMap() from claude.ts
    setTimeout(() => setIsGenerating(false), 3000);
  };

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
          <FileText size={14} className="inline mr-2" />
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
      </div>

      {activeTab === "generate" && (
        <div className="animate-fade-in">
          {/* AI Generator Panel */}
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
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
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                  Blog Posts
                </label>
                <input className="input-field" type="number" defaultValue={client?.monthlyBlogs || 4} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                  GBP Posts
                </label>
                <input className="input-field" type="number" defaultValue={client?.monthlyGbpPosts || 8} />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !seedKeyword.trim()}
              className="btn-primary mt-4"
              style={{ opacity: !seedKeyword.trim() ? 0.5 : 1 }}
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
          {/* Content Plan Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-extrabold">{plan.title}</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {plan.pieces.length} pieces · {plan.pieces.filter((p) => p.status === "PUBLISHED").length} published
              </p>
            </div>
            <button className="btn-secondary text-sm">
              <Send size={14} />
              Send for Approval
            </button>
          </div>

          {/* Content Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
            {plan.pieces.map((piece) => {
              const typeInfo = typeIcons[piece.type];
              const statusInfo = statusConfig[piece.status];

              return (
                <div key={piece.id} className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
                  {/* Type Banner */}
                  <div
                    className="px-4 py-2 flex items-center justify-between"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
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

                  {/* Content */}
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
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3 flex gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                    {piece.status === "APPROVED" || piece.status === "PLANNED" ? (
                      <button className="btn-primary text-xs flex-1" style={{ padding: "6px 12px" }}>
                        <Sparkles size={12} />
                        Generate Draft
                      </button>
                    ) : null}
                    <button className="btn-secondary text-xs" style={{ padding: "6px 12px" }}>
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
          <Sparkles size={40} style={{ color: "var(--text-muted)" }} className="mb-4" />
          <h3 className="text-lg font-bold mb-2">No Content Plan Yet</h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Switch to the AI Generator tab to create a content plan from a seed keyword.
          </p>
          <button onClick={() => setActiveTab("generate")} className="btn-primary">
            <Sparkles size={16} />
            Generate Content Plan
          </button>
        </div>
      )}
    </div>
  );
}
