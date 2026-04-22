"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getRealFailedChecks, getRealPassedChecks, getCheckLabel } from "@/lib/audit-checks";

/* ─── Types ──────────────────────────────────────────── */

interface AuditPage {
  id: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  description: string | null;
  h1Count: number;
  wordCount: number;
  imageCount: number;
  imagesNoAlt: number;
  checks: string | null;
  onpageScore: number | null;
  recommendations: string | null;
}

interface Audit {
  id: string;
  taskId: string | null;
  status: string;
  pagesCount: number;
  onpageScore: number | null;
  summary: string | null;
  crawledAt: string;
  pages?: AuditPage[];
  _count?: { pages: number };
}

interface AuditIssue {
  id: string;
  pageId: string;
  checkKey: string;
  severity: string;
  currentValue: string | null;
  suggestion: string | null;
  status: string;
  fixedAt: string | null;
  fixNotes: string | null;
  page?: { url: string; title: string | null };
}

interface Recommendation {
  checkKey: string;
  severity: string;
  issue: string;
  currentValue: string | null;
  suggestion: string;
  explanation: string;
}

/* ─── Helpers ────────────────────────────────────────── */

function scoreColor(score: number | null) {
  if (score === null) return "#6b7280";
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function severityColor(sev: string) {
  if (sev === "critical") return "#ef4444";
  if (sev === "warning") return "#f59e0b";
  return "#6366f1";
}

function statusIcon(status: string) {
  if (status === "FIXED") return "✅";
  if (status === "IGNORED") return "⏭️";
  return "🔴";
}

const STORAGE_KEY = "kngo_audit_pending";

function getPendingAudit(clientId: string): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored);
    if (data.clientId === clientId && data.auditId) return data.auditId;
    return null;
  } catch {
    return null;
  }
}

function setPendingAudit(clientId: string, auditId: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId, auditId, startedAt: Date.now() }));
}

function clearPendingAudit() {
  localStorage.removeItem(STORAGE_KEY);
}

// CHECK_LABELS now imported from @/lib/audit-checks

/* ─── Component ──────────────────────────────────────── */

export default function SiteAuditPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [audits, setAudits] = useState<Audit[]>([]);
  const [activeAudit, setActiveAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [polling, setPolling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState("");
  const [pagesCrawled, setPagesCrawled] = useState(0);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [generatingRecs, setGeneratingRecs] = useState<Set<string>>(new Set());
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [issueStats, setIssueStats] = useState({ total: 0, open: 0, fixed: 0, ignored: 0 });
  const [view, setView] = useState<"pages" | "issues">("pages");
  const [prevAudit, setPrevAudit] = useState<Audit | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAudits = useCallback(async () => {
    const url = showArchived
      ? `/api/clients/${clientId}/audit?archived=true`
      : `/api/clients/${clientId}/audit`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setAudits(data);
    }
    setLoading(false);
  }, [clientId, showArchived]);

  // Poll for results — runs in the background
  const pollResults = useCallback(async (auditId: string) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 60; // 10 minutes max

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/clients/${clientId}/audit/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auditId }),
        });
        const data = await res.json();

        if (data.pagesCrawled) setPagesCrawled(data.pagesCrawled);
        if (data.crawlProgress) setCrawlProgress(data.crawlProgress);

        if (data.status === "COMPLETED" || attempts >= maxAttempts) {
          setPolling(false);
          setCrawlProgress("");
          setPagesCrawled(0);
          clearPendingAudit();
          loadAudits();
          loadAuditDetail(auditId);
          return;
        }
      } catch (err) {
        console.error("[AUDIT POLL] Error:", err);
      }
      pollRef.current = setTimeout(poll, 10000);
    };
    pollRef.current = setTimeout(poll, 8000);
  }, [clientId, loadAudits]);

  // On mount: load audits and check for pending crawl
  useEffect(() => {
    loadAudits();
    const pendingId = getPendingAudit(clientId);
    if (pendingId) {
      pollResults(pendingId);
    }
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [clientId, loadAudits, pollResults]);

  const startAudit = async () => {
    setRunning(true);
    const res = await fetch(`/api/clients/${clientId}/audit`, { method: "POST" });
    const data = await res.json();
    if (data.auditId) {
      setPendingAudit(clientId, data.auditId);
      setPagesCrawled(0);
      setCrawlProgress("in_progress");
      pollResults(data.auditId);
    }
    setRunning(false);
    loadAudits();
  };

  const archiveAudit = async (auditId: string) => {
    await fetch(`/api/clients/${clientId}/audit/${auditId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    loadAudits();
  };

  const restoreAudit = async (auditId: string) => {
    await fetch(`/api/clients/${clientId}/audit/${auditId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    loadAudits();
  };

  const deleteAudit = async (auditId: string) => {
    await fetch(`/api/clients/${clientId}/audit/${auditId}`, {
      method: "DELETE",
    });
    setConfirmDelete(null);
    loadAudits();
  };

  const loadAuditDetail = async (auditId: string) => {
    const res = await fetch(`/api/clients/${clientId}/audit/${auditId}`);
    if (res.ok) {
      const data = await res.json();
      setActiveAudit(data);
      loadIssues(auditId);
    }
  };

  const loadIssues = async (auditId: string) => {
    const res = await fetch(`/api/clients/${clientId}/audit/issues?auditId=${auditId}`);
    if (res.ok) {
      const data = await res.json();
      setIssues(data.issues || []);
      setIssueStats(data.stats || { total: 0, open: 0, fixed: 0, ignored: 0 });
    }
  };

  const generateRecommendations = async (pageId: string, targetKeyword?: string) => {
    setGeneratingRecs((prev) => new Set(prev).add(pageId));
    try {
      const res = await fetch(`/api/clients/${clientId}/audit/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, targetKeyword }),
      });
      if (res.ok) {
        if (activeAudit) {
          await loadAuditDetail(activeAudit.id);
        }
      }
    } catch (err) {
      console.error("Failed to generate recommendations:", err);
    }
    setGeneratingRecs((prev) => {
      const n = new Set(prev);
      n.delete(pageId);
      return n;
    });
  };

  const updateIssueStatus = async (issueId: string, status: string, fixNotes?: string) => {
    await fetch(`/api/clients/${clientId}/audit/issues`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId, status, fixNotes }),
    });
    if (activeAudit) {
      loadIssues(activeAudit.id);
    }
  };

  const togglePage = (pageId: string) => {
    setExpandedPages((prev) => {
      const n = new Set(prev);
      n.has(pageId) ? n.delete(pageId) : n.add(pageId);
      return n;
    });
  };

  const parseChecks = (checksJson: string | null): Record<string, boolean> => {
    if (!checksJson) return {};
    try { return JSON.parse(checksJson); } catch { return {}; }
  };

  const parseRecs = (recsJson: string | null): Recommendation[] => {
    if (!recsJson) return [];
    try { return JSON.parse(recsJson); } catch { return []; }
  };

  const getFailedChecks = (checks: Record<string, boolean>) =>
    getRealFailedChecks(checks);

  const getPassedChecks = (checks: Record<string, boolean>) =>
    getRealPassedChecks(checks);

  // Load previous audit for comparison
  const loadPrevAudit = useCallback(async () => {
    if (!activeAudit || audits.length < 2) return;
    const idx = audits.findIndex((a) => a.id === activeAudit.id);
    if (idx < audits.length - 1) {
      const prev = audits[idx + 1];
      const res = await fetch(`/api/clients/${clientId}/audit/${prev.id}`);
      if (res.ok) setPrevAudit(await res.json());
    }
  }, [activeAudit, audits, clientId]);

  useEffect(() => { loadPrevAudit(); }, [loadPrevAudit]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        Loading audit history…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>
            🔍 Site Audit
          </h1>
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>
            On-page SEO analysis with AI-powered recommendations
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => { setShowArchived(!showArchived); setActiveAudit(null); setConfirmDelete(null); }}
            style={{
              padding: "10px 16px",
              background: showArchived ? "rgba(107,114,128,0.2)" : "transparent",
              color: showArchived ? "#e5e7eb" : "#6b7280",
              border: "1px solid #374151",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 13,
            }}
          >
            📦 {showArchived ? "View Active" : "Archive"}
          </button>
          {!showArchived && (
            <button
              onClick={startAudit}
              disabled={running || polling}
              style={{
                padding: "10px 20px",
                background: running || polling ? "#374151" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: running || polling ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {polling ? "⏳ Crawling…" : running ? "Starting…" : "Run New Audit"}
            </button>
          )}
        </div>
      </div>

      {/* Crawl progress banner — non-blocking */}
      {polling && (
        <div style={{
          background: "rgba(99,102,241,0.1)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 8, padding: 16, marginBottom: 24,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: "50%",
            border: "2px solid #6366f1", borderTopColor: "transparent",
            animation: "spin 1s linear infinite",
          }} />
          <div style={{ flex: 1 }}>
            <span style={{ color: "#a5b4fc", fontSize: 14, fontWeight: 600 }}>
              Crawling website…
            </span>
            <span style={{ color: "#9ca3af", fontSize: 13, marginLeft: 8 }}>
              {pagesCrawled > 0
                ? `${pagesCrawled} pages found so far`
                : "Starting crawl, this may take 1–5 minutes"
              }
            </span>
          </div>
          <span style={{
            background: "rgba(99,102,241,0.2)", color: "#a5b4fc",
            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
          }}>
            {crawlProgress || "starting"}
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {audits.length === 0 && !polling && (
        <div style={{
          background: "#1f2937", borderRadius: 12, padding: 60,
          textAlign: "center", border: "1px solid #374151",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{showArchived ? "📦" : "🔍"}</div>
          <h3 style={{ color: "#e5e7eb", margin: "0 0 8px" }}>
            {showArchived ? "No Archived Audits" : "No Audits Yet"}
          </h3>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            {showArchived
              ? "Archived audits will appear here. You can restore or permanently delete them."
              : "Click \"Run New Audit\" to crawl this client's website."
            }
          </p>
        </div>
      )}

      {/* Audit list */}
      {audits.length > 0 && !activeAudit && (
        <div style={{ display: "grid", gap: 12 }}>
          {audits.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#1f2937", border: "1px solid #374151", borderRadius: 12,
                padding: "16px 20px", transition: "border-color 0.2s",
              }}
            >
              <div
                onClick={() => loadAuditDetail(a.id)}
                style={{ flex: 1, cursor: "pointer" }}
              >
                <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 15 }}>
                  {new Date(a.crawledAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
                <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
                  {a.pagesCount} pages · {a.status}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ textAlign: "right" }}>
                  {a.onpageScore !== null ? (
                    <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(a.onpageScore) }}>
                      {Math.round(a.onpageScore)}<span style={{ fontSize: 14, fontWeight: 400 }}>/100</span>
                    </div>
                  ) : (
                    <span style={{ color: "#6b7280", fontSize: 14 }}>{a.status === "CRAWLING" ? "Crawling…" : "—"}</span>
                  )}
                </div>
                {/* Archive / Restore / Delete actions */}
                <div style={{ display: "flex", gap: 4 }}>
                  {showArchived ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); restoreAudit(a.id); }}
                        title="Restore"
                        style={{
                          padding: "6px 10px", background: "rgba(34,197,94,0.15)",
                          color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)",
                          borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500,
                        }}
                      >
                        ↩ Restore
                      </button>
                      {confirmDelete === a.id ? (
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <span style={{ color: "#ef4444", fontSize: 11 }}>Sure?</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAudit(a.id); }}
                            style={{
                              padding: "4px 8px", background: "#ef4444",
                              color: "#fff", border: "none",
                              borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600,
                            }}
                          >
                            Yes, delete
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                            style={{
                              padding: "4px 8px", background: "#374151",
                              color: "#9ca3af", border: "none",
                              borderRadius: 4, cursor: "pointer", fontSize: 11,
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(a.id); }}
                          title="Permanently delete"
                          style={{
                            padding: "6px 10px", background: "rgba(239,68,68,0.15)",
                            color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500,
                          }}
                        >
                          🗑 Delete
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); archiveAudit(a.id); }}
                      title="Archive this audit"
                      style={{
                        padding: "6px 10px", background: "rgba(107,114,128,0.15)",
                        color: "#9ca3af", border: "1px solid rgba(107,114,128,0.3)",
                        borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500,
                      }}
                    >
                      📦 Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Audit Detail */}
      {activeAudit && (
        <div>
          <button
            onClick={() => { setActiveAudit(null); setPrevAudit(null); setIssues([]); }}
            style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 14, marginBottom: 16, padding: 0 }}
          >
            ← Back to audit list
          </button>

          {/* Score + Summary Row */}
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, marginBottom: 24 }}>
            {/* Score gauge */}
            <div style={{
              background: "#1f2937", borderRadius: 12, border: "1px solid #374151",
              padding: 24, textAlign: "center", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ fontSize: 56, fontWeight: 900, color: scoreColor(activeAudit.onpageScore), lineHeight: 1 }}>
                {activeAudit.onpageScore !== null ? Math.round(activeAudit.onpageScore) : "—"}
              </div>
              <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>Health Score</div>
              {/* Before/After comparison */}
              {prevAudit && prevAudit.onpageScore !== null && activeAudit.onpageScore !== null && (
                <div style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: activeAudit.onpageScore > prevAudit.onpageScore ? "#22c55e" : activeAudit.onpageScore < prevAudit.onpageScore ? "#ef4444" : "#9ca3af",
                  fontWeight: 600,
                }}>
                  {activeAudit.onpageScore > prevAudit.onpageScore ? "▲" : activeAudit.onpageScore < prevAudit.onpageScore ? "▼" : "—"}
                  {" "}{Math.abs(Math.round(activeAudit.onpageScore - prevAudit.onpageScore))} pts vs previous
                </div>
              )}
            </div>

            {/* Stats cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {[
                { label: "Pages", value: activeAudit.pagesCount, icon: "📄" },
                { label: "Total Issues", value: issueStats.total || "—", icon: "⚠️" },
                { label: "Open", value: issueStats.open, icon: "🔴", color: "#ef4444" },
                { label: "Fixed", value: issueStats.fixed, icon: "✅", color: "#22c55e" },
                { label: "Date", value: new Date(activeAudit.crawledAt).toLocaleDateString(), icon: "📅" },
              ].map((c) => (
                <div key={c.label} style={{ background: "#1f2937", borderRadius: 10, border: "1px solid #374151", padding: 16 }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "color" in c && c.color ? c.color : "#e5e7eb" }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#111827", borderRadius: 8, padding: 4, width: "fit-content" }}>
            {[
              { key: "pages" as const, label: "📄 Page Analysis" },
              { key: "issues" as const, label: "📋 Issue Tracker" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                style={{
                  padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: view === tab.key ? "#6366f1" : "transparent",
                  color: view === tab.key ? "#fff" : "#9ca3af",
                  fontWeight: 600, fontSize: 13,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ═══ PAGE ANALYSIS VIEW ═══ */}
          {view === "pages" && (
            <div style={{ background: "#1f2937", borderRadius: 12, border: "1px solid #374151", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #374151", color: "#e5e7eb", fontWeight: 600, fontSize: 15 }}>
                Page-by-Page Analysis
              </div>

              {(activeAudit.pages || []).map((page) => {
                const checks = parseChecks(page.checks);
                const failed = getFailedChecks(checks);
                const passed = getPassedChecks(checks);
                const recs = parseRecs(page.recommendations);
                const expanded = expandedPages.has(page.id);
                const isGenerating = generatingRecs.has(page.id);

                return (
                  <div key={page.id} style={{ borderBottom: "1px solid #374151" }}>
                    {/* Row header */}
                    <button
                      onClick={() => togglePage(page.id)}
                      style={{
                        display: "grid", gridTemplateColumns: "1fr 80px 80px 60px",
                        gap: 12, width: "100%", padding: "12px 20px",
                        background: "transparent", border: "none", cursor: "pointer",
                        textAlign: "left", alignItems: "center",
                      }}
                    >
                      <div>
                        <a
                          href={page.url.startsWith("http") ? page.url : `https://${page.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "#a5b4fc", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", display: "block" }}
                          onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          {page.url.replace(/^https?:\/\//, "")}
                        </a>
                        {page.title && <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{page.title}</div>}
                      </div>
                      <div style={{ color: scoreColor(page.onpageScore), fontWeight: 700, fontSize: 14, textAlign: "right" }}>
                        {page.onpageScore !== null ? (
                          <>{Math.round(page.onpageScore)}<span style={{ fontSize: 10, fontWeight: 400, color: "#6b7280" }}>/100</span></>
                        ) : "—"}
                        <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 400 }}>Score</div>
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{
                          background: failed.length > 0 ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                          color: failed.length > 0 ? "#ef4444" : "#22c55e",
                          padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                        }}>
                          {failed.length} issue{failed.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 16 }}>{expanded ? "▼" : "▶"}</div>
                    </button>

                    {/* Expanded detail */}
                    {expanded && (
                      <div style={{ padding: "12px 20px 20px", background: "#111827" }}>
                        {/* Meta stats */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                          {[
                            { l: "Status", v: page.statusCode || "—" },
                            { l: "Word Count", v: page.wordCount },
                            { l: "Images", v: page.imageCount },
                            { l: "No Alt", v: page.imagesNoAlt },
                          ].map((m) => (
                            <div key={m.l} style={{ background: "#1f2937", borderRadius: 6, padding: "8px 12px" }}>
                              <div style={{ color: "#6b7280", fontSize: 11 }}>{m.l}</div>
                              <div style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 600 }}>{m.v}</div>
                            </div>
                          ))}
                        </div>

                        {/* Generate Recommendations button */}
                        {failed.length > 0 && (
                          <button
                            onClick={() => generateRecommendations(page.id)}
                            disabled={isGenerating}
                            style={{
                              padding: "8px 16px", marginBottom: 16,
                              background: isGenerating ? "#374151" : "linear-gradient(135deg, #8b5cf6, #a855f7)",
                              color: "#fff", border: "none", borderRadius: 8,
                              cursor: isGenerating ? "not-allowed" : "pointer",
                              fontWeight: 600, fontSize: 13,
                              display: "flex", alignItems: "center", gap: 8,
                            }}
                          >
                            {isGenerating ? (
                              <>
                                <span style={{
                                  width: 14, height: 14, borderRadius: "50%",
                                  border: "2px solid #a855f7", borderTopColor: "transparent",
                                  animation: "spin 1s linear infinite", display: "inline-block",
                                }} />
                                Generating…
                              </>
                            ) : recs.length > 0 ? (
                              "🔄 Regenerate AI Recommendations"
                            ) : (
                              "✨ Generate AI Recommendations"
                            )}
                          </button>
                        )}

                        {/* AI Recommendations */}
                        {recs.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ color: "#a855f7", fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                              ✨ AI Recommendations ({recs.length})
                            </div>
                            <div style={{ display: "grid", gap: 10 }}>
                              {recs.map((rec, i) => (
                                <div key={i} style={{
                                  background: "#1f2937", borderRadius: 10,
                                  border: `1px solid ${severityColor(rec.severity)}30`,
                                  padding: 16, position: "relative",
                                }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{
                                        background: `${severityColor(rec.severity)}20`,
                                        color: severityColor(rec.severity),
                                        padding: "2px 8px", borderRadius: 4,
                                        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                                      }}>
                                        {rec.severity}
                                      </span>
                                      <span style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 600 }}>
                                        {rec.issue}
                                      </span>
                                    </div>
                                  </div>

                                  {rec.currentValue && (
                                    <div style={{ marginBottom: 8 }}>
                                      <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 2 }}>CURRENT</div>
                                      <div style={{
                                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                                        borderRadius: 6, padding: "8px 12px", color: "#fca5a5",
                                        fontSize: 13, fontFamily: "monospace",
                                      }}>
                                        {rec.currentValue}
                                      </div>
                                    </div>
                                  )}

                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 2 }}>SUGGESTED FIX</div>
                                    <div style={{
                                      background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                                      borderRadius: 6, padding: "8px 12px", color: "#86efac",
                                      fontSize: 13, fontFamily: "monospace",
                                    }}>
                                      {rec.suggestion}
                                    </div>
                                  </div>

                                  <div style={{ color: "#9ca3af", fontSize: 12, fontStyle: "italic" }}>
                                    💡 {rec.explanation}
                                  </div>

                                  {/* Copy + Mark Fixed buttons */}
                                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(rec.suggestion)}
                                      style={{
                                        padding: "4px 12px", background: "#374151", color: "#d1d5db",
                                        border: "1px solid #4b5563", borderRadius: 6,
                                        cursor: "pointer", fontSize: 12, fontWeight: 500,
                                      }}
                                    >
                                      📋 Copy
                                    </button>
                                    <button
                                      onClick={() => {
                                        const issueId = `${page.id}_${rec.checkKey}`;
                                        updateIssueStatus(issueId, "FIXED", `Applied suggestion: ${rec.suggestion.substring(0, 100)}`);
                                      }}
                                      style={{
                                        padding: "4px 12px", background: "rgba(34,197,94,0.15)", color: "#22c55e",
                                        border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6,
                                        cursor: "pointer", fontSize: 12, fontWeight: 500,
                                      }}
                                    >
                                      ✅ Mark Fixed
                                    </button>
                                    <button
                                      onClick={() => {
                                        const issueId = `${page.id}_${rec.checkKey}`;
                                        updateIssueStatus(issueId, "IGNORED");
                                      }}
                                      style={{
                                        padding: "4px 12px", background: "rgba(107,114,128,0.15)", color: "#9ca3af",
                                        border: "1px solid rgba(107,114,128,0.3)", borderRadius: 6,
                                        cursor: "pointer", fontSize: 12, fontWeight: 500,
                                      }}
                                    >
                                      ⏭️ Ignore
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Raw failed checks (if no recs yet) */}
                        {recs.length === 0 && failed.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                              ❌ Issues ({failed.length})
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {failed.map((c) => (
                                <span key={c} style={{
                                  background: "rgba(239,68,68,0.1)", color: "#fca5a5",
                                  padding: "4px 10px", borderRadius: 6, fontSize: 12,
                                  border: "1px solid rgba(239,68,68,0.2)",
                                }}>
                                  {getCheckLabel(c)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Passed checks */}
                        {passed.length > 0 && (
                          <div>
                            <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                              ✅ Passed ({passed.length})
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {passed.map((c) => (
                                <span key={c} style={{
                                  background: "rgba(34,197,94,0.06)", color: "#86efac",
                                  padding: "4px 10px", borderRadius: 6, fontSize: 12,
                                  border: "1px solid rgba(34,197,94,0.15)",
                                }}>
                                  {getCheckLabel(c)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ ISSUE TRACKER VIEW ═══ */}
          {view === "issues" && (
            <div>
              {issues.length === 0 ? (
                <div style={{
                  background: "#1f2937", borderRadius: 12, padding: 40,
                  textAlign: "center", border: "1px solid #374151",
                }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
                  <h3 style={{ color: "#e5e7eb", margin: "0 0 8px" }}>No Issues Tracked Yet</h3>
                  <p style={{ color: "#9ca3af", fontSize: 14 }}>
                    Open the Page Analysis view and click &quot;Generate AI Recommendations&quot; on pages with issues.
                  </p>
                </div>
              ) : (
                <div style={{ background: "#1f2937", borderRadius: 12, border: "1px solid #374151", overflow: "hidden" }}>
                  {/* Progress bar */}
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #374151" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 15 }}>Issue Tracker</span>
                      <span style={{ color: "#9ca3af", fontSize: 13 }}>
                        {issueStats.fixed}/{issueStats.total} fixed
                        {issueStats.total > 0 && ` (${Math.round((issueStats.fixed / issueStats.total) * 100)}%)`}
                      </span>
                    </div>
                    <div style={{ height: 6, background: "#374151", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: issueStats.total > 0 ? `${(issueStats.fixed / issueStats.total) * 100}%` : "0%",
                        background: "linear-gradient(90deg, #22c55e, #4ade80)",
                        borderRadius: 3,
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                  </div>

                  {/* Issues list */}
                  {issues.map((issue) => (
                    <div key={issue.id} style={{
                      display: "grid",
                      gridTemplateColumns: "30px 1fr 120px 120px",
                      gap: 12, padding: "12px 20px",
                      borderBottom: "1px solid #1a2332",
                      alignItems: "center",
                      opacity: issue.status === "IGNORED" ? 0.5 : 1,
                    }}>
                      <span style={{ fontSize: 16 }}>{statusIcon(issue.status)}</span>
                      <div>
                        <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 500 }}>
                          {getCheckLabel(issue.checkKey)}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {issue.page?.url?.replace(/^https?:\/\//, "") || ""}
                        </div>
                        {issue.suggestion && (
                          <div style={{ color: "#86efac", fontSize: 12, marginTop: 4, fontFamily: "monospace" }}>
                            → {issue.suggestion.substring(0, 80)}{issue.suggestion.length > 80 ? "…" : ""}
                          </div>
                        )}
                        {issue.fixNotes && issue.status === "FIXED" && (
                          <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 2, fontStyle: "italic" }}>
                            Notes: {issue.fixNotes.substring(0, 60)}
                          </div>
                        )}
                      </div>
                      <span style={{
                        background: `${severityColor(issue.severity)}20`,
                        color: severityColor(issue.severity),
                        padding: "2px 8px", borderRadius: 4,
                        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                        textAlign: "center",
                      }}>
                        {issue.severity}
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {issue.status !== "FIXED" && (
                          <button
                            onClick={() => updateIssueStatus(issue.id, "FIXED")}
                            style={{
                              padding: "4px 8px", background: "rgba(34,197,94,0.15)",
                              color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)",
                              borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 500,
                            }}
                          >
                            ✅ Fix
                          </button>
                        )}
                        {issue.status === "FIXED" && (
                          <button
                            onClick={() => updateIssueStatus(issue.id, "OPEN")}
                            style={{
                              padding: "4px 8px", background: "rgba(239,68,68,0.15)",
                              color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)",
                              borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 500,
                            }}
                          >
                            ↩ Reopen
                          </button>
                        )}
                        {issue.status === "OPEN" && (
                          <button
                            onClick={() => updateIssueStatus(issue.id, "IGNORED")}
                            style={{
                              padding: "4px 8px", background: "rgba(107,114,128,0.15)",
                              color: "#9ca3af", border: "1px solid rgba(107,114,128,0.3)",
                              borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 500,
                            }}
                          >
                            ⏭️ Ignore
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Re-audit CTA */}
              {issueStats.fixed > 0 && (
                <div style={{
                  marginTop: 20, background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12,
                  padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ color: "#22c55e", fontWeight: 600, fontSize: 15 }}>
                      🎉 {issueStats.fixed} issues marked fixed!
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
                      After applying fixes to your live website, run a new audit to verify improvements and get an updated score.
                    </div>
                  </div>
                  <button
                    onClick={startAudit}
                    disabled={running || polling}
                    style={{
                      padding: "10px 20px", flexShrink: 0,
                      background: "linear-gradient(135deg, #22c55e, #16a34a)",
                      color: "#fff", border: "none", borderRadius: 8,
                      cursor: "pointer", fontWeight: 600, fontSize: 14,
                    }}
                  >
                    🔄 Re-Audit Now
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
