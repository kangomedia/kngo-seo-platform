"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  MapPin,
  Megaphone,
  HelpCircle,
  Loader2,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Send,
  XCircle,
  ExternalLink,
  Calendar,
  ChevronDown,
  X,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { TIER_LABELS, TIER_COLORS } from "@/lib/tier-config";

interface QueueItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  keyword: string | null;
  body: boolean;
  status: string;
  priority: number;
  revisionCount: number;
  dueDate: string | null;
  scheduledPublishDate: string | null;
  publishedUrl: string | null;
  publishedAt: string | null;
  planTitle: string;
  planMonth: number;
  planYear: number;
  clientId: string;
  clientName: string;
  clientDomain: string | null;
  clientTier: string;
  approval: { outcome: string; notes?: string; decidedAt: string } | null;
  createdAt: string;
}

type StatusCounts = Record<string, number>;

// Pipeline columns configuration
const COLUMNS = [
  {
    key: "APPROVED",
    label: "Approved",
    sublabel: "Needs writing",
    icon: CheckCircle2,
    color: "#22c55e",
    statuses: ["APPROVED"],
  },
  {
    key: "WRITING",
    label: "Writing",
    sublabel: "AI drafting",
    icon: Edit3,
    color: "#f59e0b",
    statuses: ["WRITING"],
  },
  {
    key: "REVIEW",
    label: "Client Review",
    sublabel: "Awaiting feedback",
    icon: Eye,
    color: "#3b82f6",
    statuses: ["CLIENT_REVIEW", "DRAFT_REVIEW"],
  },
  {
    key: "READY",
    label: "Ready to Publish",
    sublabel: "Approved drafts",
    icon: Send,
    color: "#8b5cf6",
    statuses: ["READY_TO_PUBLISH"],
  },
  {
    key: "PUBLISHED",
    label: "Published",
    sublabel: "Live content",
    icon: ExternalLink,
    color: "#10b981",
    statuses: ["PUBLISHED"],
  },
];

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  BLOG_POST: { icon: <FileText size={12} />, label: "Blog", color: "#3B82F6" },
  GBP_POST: { icon: <MapPin size={12} />, label: "GBP", color: "#10B981" },
  GBP_QA: { icon: <HelpCircle size={12} />, label: "Q&A", color: "#06B6D4" },
  PRESS_RELEASE: { icon: <Megaphone size={12} />, label: "PR", color: "#8B5CF6" },
};

export default function ContentQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({});
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Publish modal
  const [publishModal, setPublishModal] = useState<QueueItem | null>(null);
  const [publishUrl, setPublishUrl] = useState("");
  const [publishDate, setPublishDate] = useState("");

  const loadQueue = async () => {
    try {
      const res = await fetch("/api/content/queue");
      const data = await res.json();
      setQueue(data.queue || []);
      setCounts(data.counts || {});
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  // Get unique clients for filter
  const clients = [
    ...new Map(queue.map((q) => [q.clientId, { id: q.clientId, name: q.clientName }])).values(),
  ];

  // Filter queue
  const filteredQueue = queue.filter((item) => {
    if (clientFilter !== "all" && item.clientId !== clientFilter) return false;
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    return true;
  });

  // Group by column
  const getColumnItems = (statuses: string[]) =>
    filteredQueue.filter((item) => statuses.includes(item.status));

  // Status transition handler
  const updateStatus = async (pieceId: string, newStatus: string, extra?: Record<string, unknown>) => {
    setUpdatingId(pieceId);
    try {
      const res = await fetch(`/api/content/pieces/${pieceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      if (res.ok) {
        await loadQueue();
      }
    } catch {
      // silently fail
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePublish = async () => {
    if (!publishModal) return;
    await updateStatus(publishModal.id, "PUBLISHED", {
      publishedUrl: publishUrl || null,
      publishedAt: publishDate || new Date().toISOString(),
    });
    setPublishModal(null);
    setPublishUrl("");
    setPublishDate("");
  };

  const totalActive = (counts.APPROVED || 0) + (counts.WRITING || 0) +
    (counts.CLIENT_REVIEW || 0) + (counts.DRAFT_REVIEW || 0) +
    (counts.READY_TO_PUBLISH || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] stagger">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-3">
            <Sparkles size={24} style={{ color: "var(--accent)" }} />
            Content Pipeline
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {totalActive} pieces in progress · {counts.PUBLISHED || 0} published this cycle
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <select
            className="input-field text-sm pr-8"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="all">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
        </div>
        <div className="relative">
          <select
            className="input-field text-sm pr-8"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="all">All Types</option>
            <option value="BLOG_POST">Blog Posts</option>
            <option value="GBP_POST">GBP Posts</option>
            <option value="GBP_QA">GBP Q&As</option>
            <option value="PRESS_RELEASE">Press Releases</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>

      {/* Pipeline Columns */}
      {queue.length === 0 ? (
        <div className="stat-card text-center py-16">
          <BookOpen size={40} className="mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <h2 className="text-lg font-bold mb-2">No Content in Pipeline</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Generate content plans for your clients to populate the pipeline.
          </p>
          <Link href="/agency/clients" className="btn-primary inline-flex">
            Go to Clients
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ alignItems: "start" }}>
          {COLUMNS.map((col) => {
            const items = getColumnItems(col.statuses);
            const Icon = col.icon;
            return (
              <div key={col.key}>
                {/* Column Header */}
                <div
                  className="flex items-center gap-2 px-3 py-3 rounded-xl mb-3"
                  style={{
                    background: `${col.color}15`,
                    border: `1px solid ${col.color}30`,
                  }}
                >
                  <Icon size={16} style={{ color: col.color }} />
                  <span className="text-sm font-bold" style={{ color: col.color }}>
                    {col.label}
                  </span>
                  <span
                    className="ml-auto text-xs font-extrabold px-2 py-0.5 rounded-full"
                    style={{ background: `${col.color}20`, color: col.color }}
                  >
                    {items.length}
                  </span>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: "var(--text-muted)" }}>
                  {col.sublabel}
                </p>

                {/* Column Cards */}
                <div className="flex flex-col gap-2">
                  {items.length === 0 ? (
                    <div
                      className="rounded-xl p-4 text-center"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px dashed var(--border)",
                      }}
                    >
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        No items
                      </p>
                    </div>
                  ) : (
                    items.map((item) => {
                      const typeInfo = TYPE_CONFIG[item.type] || TYPE_CONFIG.BLOG_POST;
                      const isUpdating = updatingId === item.id;

                      return (
                        <div
                          key={item.id}
                          className="rounded-xl overflow-hidden transition-all hover:translate-y-[-1px]"
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            opacity: isUpdating ? 0.5 : 1,
                          }}
                        >
                          {/* Card Header — Type + Client */}
                          <div
                            className="px-3 py-2 flex items-center gap-2"
                            style={{ borderBottom: "1px solid var(--border)" }}
                          >
                            <span
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                              style={{ background: `${typeInfo.color}20`, color: typeInfo.color }}
                            >
                              {typeInfo.icon}
                              {typeInfo.label}
                            </span>
                            <Link
                              href={`/agency/clients/${item.clientId}`}
                              className="ml-auto text-[10px] font-bold truncate max-w-[80px] hover:underline"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {item.clientName}
                            </Link>
                          </div>

                          {/* Card Body */}
                          <div className="p-3">
                            <h4
                              className="text-xs font-bold leading-snug mb-1 line-clamp-2"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {item.title}
                            </h4>
                            {item.keyword && (
                              <span
                                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded inline-block"
                                style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}
                              >
                                🎯 {item.keyword}
                              </span>
                            )}
                            {item.revisionCount > 0 && (
                              <span
                                className="text-[9px] font-bold ml-1 px-1.5 py-0.5 rounded inline-block"
                                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                              >
                                Rev {item.revisionCount}
                              </span>
                            )}
                          </div>

                          {/* Card Actions */}
                          <div
                            className="px-3 py-2 flex gap-1"
                            style={{ borderTop: "1px solid var(--border)" }}
                          >
                            {/* Actions based on column */}
                            {col.key === "APPROVED" && (
                              <button
                                onClick={() => updateStatus(item.id, "WRITING")}
                                disabled={isUpdating}
                                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                              >
                                <Edit3 size={10} /> Start Writing
                              </button>
                            )}
                            {col.key === "WRITING" && (
                              <button
                                onClick={() => updateStatus(item.id, "DRAFT_REVIEW")}
                                disabled={isUpdating}
                                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                                style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}
                              >
                                <Send size={10} /> Send for Review
                              </button>
                            )}
                            {col.key === "REVIEW" && (
                              <>
                                <button
                                  onClick={() => updateStatus(item.id, "READY_TO_PUBLISH")}
                                  disabled={isUpdating}
                                  className="flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                                  style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}
                                >
                                  <CheckCircle2 size={10} /> Approve
                                </button>
                                <button
                                  onClick={() => updateStatus(item.id, "WRITING")}
                                  disabled={isUpdating}
                                  className="text-[10px] font-bold py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1"
                                  style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                                >
                                  <Edit3 size={10} /> Revise
                                </button>
                              </>
                            )}
                            {col.key === "READY" && (
                              <button
                                onClick={() => {
                                  setPublishModal(item);
                                  setPublishDate(new Date().toISOString().split("T")[0]);
                                }}
                                disabled={isUpdating}
                                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                                style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}
                              >
                                <ExternalLink size={10} /> Mark Published
                              </button>
                            )}
                            {col.key === "PUBLISHED" && item.publishedUrl && (
                              <a
                                href={item.publishedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                                style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}
                              >
                                <ExternalLink size={10} /> View Live
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Publish Modal */}
      {publishModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPublishModal(null);
          }}
        >
          <div
            className="stat-card w-full max-w-md mx-4 animate-fade-in"
            style={{ padding: 24 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold flex items-center gap-2">
                <ExternalLink size={20} style={{ color: "var(--success)" }} />
                Mark as Published
              </h3>
              <button
                onClick={() => setPublishModal(null)}
                className="p-1 rounded-lg hover:bg-white/5"
              >
                <X size={20} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            <div
              className="p-3 rounded-xl mb-4"
              style={{ background: "var(--bg-card-hover)" }}
            >
              <p className="text-xs font-bold uppercase mb-1" style={{ color: "var(--text-muted)" }}>
                {publishModal.clientName}
              </p>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {publishModal.title}
              </p>
            </div>

            <div className="mb-4">
              <label
                className="text-xs font-bold uppercase tracking-wide mb-2 block"
                style={{ color: "var(--text-muted)" }}
              >
                Published URL (optional)
              </label>
              <input
                className="input-field"
                placeholder="https://example.com/blog/article-title"
                value={publishUrl}
                onChange={(e) => setPublishUrl(e.target.value)}
              />
            </div>

            <div className="mb-6">
              <label
                className="text-xs font-bold uppercase tracking-wide mb-2 block"
                style={{ color: "var(--text-muted)" }}
              >
                <Calendar size={12} className="inline mr-1" />
                Publish Date
              </label>
              <input
                type="date"
                className="input-field"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handlePublish} className="btn-primary flex-1">
                <CheckCircle2 size={16} />
                Confirm Published
              </button>
              <button onClick={() => setPublishModal(null)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
