"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

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

const CHECK_LABELS: Record<string, string> = {
  no_title: "Missing title tag",
  title_too_long: "Title too long (>60 chars)",
  title_too_short: "Title too short (<30 chars)",
  no_description: "Missing meta description",
  description_too_long: "Description too long (>160 chars)",
  description_too_short: "Description too short (<70 chars)",
  no_h1_tag: "Missing H1 tag",
  duplicate_title_tag: "Duplicate title tag",
  duplicate_description: "Duplicate meta description",
  no_image_alt: "Images without alt text",
  no_image_title: "Images without title",
  seo_friendly_url: "URL not SEO-friendly",
  no_favicon: "Missing favicon",
  no_content_encoding: "No content encoding (gzip)",
  is_redirect: "Page redirects",
  is_4xx_code: "4xx error status",
  is_5xx_code: "5xx error status",
  is_broken: "Broken page",
  has_redirect_chain: "Redirect chain detected",
  low_content_rate: "Low content ratio",
  high_loading_time: "Slow page load",
  is_orphan_page: "Orphan page (no internal links)",
  has_meta_refresh_redirect: "Meta refresh redirect",
  large_page_size: "Large page size",
  is_http: "Not using HTTPS",
  no_doctype: "Missing DOCTYPE",
  canonical: "Canonical issues",
  no_encoding_meta_tag: "Missing encoding meta tag",
};

/* ─── Component ──────────────────────────────────────── */

export default function SiteAuditPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [audits, setAudits] = useState<Audit[]>([]);
  const [activeAudit, setActiveAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [polling, setPolling] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [generatingRecs, setGeneratingRecs] = useState<Set<string>>(new Set());
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [issueStats, setIssueStats] = useState({ total: 0, open: 0, fixed: 0, ignored: 0 });
  const [view, setView] = useState<"pages" | "issues">("pages");
  const [prevAudit, setPrevAudit] = useState<Audit | null>(null);

  const loadAudits = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/audit`);
    if (res.ok) {
      const data = await res.json();
      setAudits(data);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadAudits(); }, [loadAudits]);

  const startAudit = async () => {
    setRunning(true);
    const res = await fetch(`/api/clients/${clientId}/audit`, { method: "POST" });
    const data = await res.json();
    if (data.auditId) {
      setPolling(true);
      pollResults(data.auditId);
    }
    setRunning(false);
    loadAudits();
  };

  const pollResults = async (auditId: string) => {
    let attempts = 0;
    const poll = async () => {
      attempts++;
      const res = await fetch(`/api/clients/${clientId}/audit/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId }),
      });
      const data = await res.json();
      if (data.status === "COMPLETED" || attempts >= 30) {
        setPolling(false);
        loadAudits();
        loadAuditDetail(auditId);
        return;
      }
      setTimeout(poll, 10000);
    };
    setTimeout(poll, 10000);
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
        // Reload audit detail to get fresh recommendations
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
    Object.entries(checks).filter(([, v]) => v).map(([k]) => k);

  const getPassedChecks = (checks: Record<string, boolean>) =>
    Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);

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
      </div>

      {/* Polling indicator */}
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
          <span style={{ color: "#a5b4fc", fontSize: 14 }}>
            Crawling website… This may take 1–5 minutes.
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
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <h3 style={{ color: "#e5e7eb", margin: "0 0 8px" }}>No Audits Yet</h3>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            Click &quot;Run New Audit&quot; to crawl this client&apos;s website.
          </p>
        </div>
      )}

      {/* Audit list */}
      {audits.length > 0 && !activeAudit && (
        <div style={{ display: "grid", gap: 12 }}>
          {audits.map((a) => (
            <button
              key={a.id}
              onClick={() => loadAuditDetail(a.id)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#1f2937", border: "1px solid #374151", borderRadius: 12,
                padding: "16px 20px", cursor: "pointer", textAlign: "left", width: "100%",
                transition: "border-color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = "#374151")}
            >
              <div>
                <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 15 }}>
                  {new Date(a.crawledAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
                <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
                  {a.pagesCount} pages · {a.status}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {a.onpageScore !== null ? (
                  <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(a.onpageScore) }}>
                    {Math.round(a.onpageScore)}<span style={{ fontSize: 14, fontWeight: 400 }}>/100</span>
                  </div>
                ) : (
                  <span style={{ color: "#6b7280", fontSize: 14 }}>{a.status === "CRAWLING" ? "Crawling…" : "—"}</span>
                )}
              </div>
            </button>
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
                        <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {page.url.replace(/^https?:\/\//, "")}
                        </div>
                        {page.title && <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{page.title}</div>}
                      </div>
                      <div style={{ color: scoreColor(page.onpageScore), fontWeight: 700, fontSize: 14 }}>
                        {page.onpageScore !== null ? Math.round(page.onpageScore) : "—"}
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
                                  {CHECK_LABELS[c] || c.replace(/_/g, " ")}
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
                                  {CHECK_LABELS[c] || c.replace(/_/g, " ")}
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
                          {CHECK_LABELS[issue.checkKey] || issue.checkKey.replace(/_/g, " ")}
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
                            ⏭️
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
