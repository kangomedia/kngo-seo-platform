"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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

/* ─── Helpers ────────────────────────────────────────── */

function scoreColor(score: number | null) {
  if (score === null) return "#6b7280";
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function severityBadge(failed: boolean) {
  return failed
    ? "background: rgba(239,68,68,0.15); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;"
    : "background: rgba(34,197,94,0.15); color: #22c55e; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;";
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

  const loadAudits = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/audit`);
    if (res.ok) setAudits(await res.json());
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadAudits(); }, [loadAudits]);

  // Start a new crawl
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

  // Poll for results
  const pollResults = async (auditId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 5 min max
    const interval = 10000; // 10s

    const poll = async () => {
      attempts++;
      const res = await fetch(`/api/clients/${clientId}/audit/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId }),
      });
      const data = await res.json();

      if (data.status === "COMPLETED" || attempts >= maxAttempts) {
        setPolling(false);
        loadAudits();
        // Load the completed audit detail
        loadAuditDetail(auditId);
        return;
      }

      setTimeout(poll, interval);
    };

    setTimeout(poll, interval);
  };

  // Load specific audit detail
  const loadAuditDetail = async (auditId: string) => {
    const res = await fetch(`/api/clients/${clientId}/audit/${auditId}`);
    if (res.ok) {
      setActiveAudit(await res.json());
    }
  };

  const togglePage = (pageId: string) => {
    setExpandedPages((prev) => {
      const n = new Set(prev);
      n.has(pageId) ? n.delete(pageId) : n.add(pageId);
      return n;
    });
  };

  // Parse checks JSON into categorized issues
  const parseChecks = (checksJson: string | null): Record<string, boolean> => {
    if (!checksJson) return {};
    try { return JSON.parse(checksJson); } catch { return {}; }
  };

  const getIssues = (checks: Record<string, boolean>) => {
    const failed: string[] = [];
    const passed: string[] = [];
    for (const [key, val] of Object.entries(checks)) {
      if (val === true) failed.push(key);
      else passed.push(key);
    }
    return { failed, passed };
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        Loading audit history…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>
            🔍 Site Audit
          </h1>
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>
            On-page SEO analysis powered by DataForSEO
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
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: "50%",
            border: "2px solid #6366f1", borderTopColor: "transparent",
            animation: "spin 1s linear infinite",
          }} />
          <span style={{ color: "#a5b4fc", fontSize: 14 }}>
            Crawling website… This may take 1–5 minutes. Results will appear automatically.
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Past audits list */}
      {audits.length === 0 && !polling ? (
        <div style={{
          background: "#1f2937",
          borderRadius: 12,
          padding: 60,
          textAlign: "center",
          border: "1px solid #374151",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <h3 style={{ color: "#e5e7eb", margin: "0 0 8px" }}>No Audits Yet</h3>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            Click &quot;Run New Audit&quot; to crawl this client&apos;s website and get an SEO health report.
          </p>
        </div>
      ) : (
        <>
          {/* Audit cards */}
          {!activeAudit && (
            <div style={{ display: "grid", gap: 12 }}>
              {audits.map((a) => (
                <button
                  key={a.id}
                  onClick={() => loadAuditDetail(a.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 12,
                    padding: "16px 20px",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "border-color 0.2s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = "#374151")}
                >
                  <div>
                    <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 15 }}>
                      {new Date(a.crawledAt).toLocaleDateString("en-US", {
                        month: "long", day: "numeric", year: "numeric",
                      })}
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
                      {a.pagesCount} pages crawled · Status: {a.status}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {a.onpageScore !== null ? (
                      <div style={{
                        fontSize: 28, fontWeight: 800,
                        color: scoreColor(a.onpageScore),
                      }}>
                        {Math.round(a.onpageScore)}
                        <span style={{ fontSize: 14, fontWeight: 400 }}>/100</span>
                      </div>
                    ) : (
                      <span style={{ color: "#6b7280", fontSize: 14 }}>
                        {a.status === "CRAWLING" ? "Crawling…" : "—"}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Active audit detail */}
          {activeAudit && (
            <div>
              <button
                onClick={() => setActiveAudit(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6366f1",
                  cursor: "pointer",
                  fontSize: 14,
                  marginBottom: 16,
                  padding: 0,
                }}
              >
                ← Back to audit list
              </button>

              {/* Score & Summary */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr",
                gap: 24,
                marginBottom: 24,
              }}>
                {/* Score gauge */}
                <div style={{
                  background: "#1f2937",
                  borderRadius: 12,
                  border: "1px solid #374151",
                  padding: 24,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <div style={{
                    fontSize: 56, fontWeight: 900,
                    color: scoreColor(activeAudit.onpageScore),
                    lineHeight: 1,
                  }}>
                    {activeAudit.onpageScore !== null ? Math.round(activeAudit.onpageScore) : "—"}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
                    Health Score
                  </div>
                </div>

                {/* Summary cards */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                }}>
                  {[
                    { label: "Pages Crawled", value: activeAudit.pagesCount, icon: "📄" },
                    { label: "Issues Found", value: activeAudit.pages?.reduce((acc, p) => {
                      const checks = parseChecks(p.checks);
                      return acc + Object.values(checks).filter(Boolean).length;
                    }, 0) || 0, icon: "⚠️" },
                    { label: "Avg Score", value: activeAudit.pages?.length
                      ? Math.round(
                          activeAudit.pages.reduce((a, p) => a + (p.onpageScore || 0), 0) /
                          activeAudit.pages.length
                        )
                      : "—", icon: "📊" },
                    { label: "Date", value: new Date(activeAudit.crawledAt).toLocaleDateString(), icon: "📅" },
                  ].map((card) => (
                    <div key={card.label} style={{
                      background: "#1f2937",
                      borderRadius: 10,
                      border: "1px solid #374151",
                      padding: 16,
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{card.icon}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#e5e7eb" }}>{card.value}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>{card.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pages table */}
              <div style={{
                background: "#1f2937",
                borderRadius: 12,
                border: "1px solid #374151",
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #374151",
                  color: "#e5e7eb",
                  fontWeight: 600,
                  fontSize: 15,
                }}>
                  Page-by-Page Analysis
                </div>

                {(activeAudit.pages || []).map((page) => {
                  const checks = parseChecks(page.checks);
                  const { failed, passed } = getIssues(checks);
                  const expanded = expandedPages.has(page.id);

                  return (
                    <div key={page.id} style={{ borderBottom: "1px solid #374151" }}>
                      <button
                        onClick={() => togglePage(page.id)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 80px 80px 60px",
                          gap: 12,
                          width: "100%",
                          padding: "12px 20px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{
                            color: "#e5e7eb",
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            {page.url.replace(/^https?:\/\//, "")}
                          </div>
                          {page.title && (
                            <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                              {page.title}
                            </div>
                          )}
                        </div>
                        <div style={{
                          color: scoreColor(page.onpageScore),
                          fontWeight: 700,
                          fontSize: 14,
                        }}>
                          {page.onpageScore !== null ? Math.round(page.onpageScore) : "—"}
                        </div>
                        <div>
                          <span style={failed.length > 0 ? { ...parseStyle(severityBadge(true)) } : { ...parseStyle(severityBadge(false)) }}>
                            {failed.length} issue{failed.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 16 }}>
                          {expanded ? "▼" : "▶"}
                        </div>
                      </button>

                      {expanded && (
                        <div style={{
                          padding: "12px 20px 20px 20px",
                          background: "#111827",
                        }}>
                          {/* Page meta */}
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: 10,
                            marginBottom: 16,
                          }}>
                            {[
                              { l: "Status", v: page.statusCode || "—" },
                              { l: "Word Count", v: page.wordCount },
                              { l: "Images", v: page.imageCount },
                              { l: "Images No Alt", v: page.imagesNoAlt },
                            ].map((m) => (
                              <div key={m.l} style={{
                                background: "#1f2937",
                                borderRadius: 6,
                                padding: "8px 12px",
                              }}>
                                <div style={{ color: "#6b7280", fontSize: 11 }}>{m.l}</div>
                                <div style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 600 }}>{m.v}</div>
                              </div>
                            ))}
                          </div>

                          {/* Failed checks */}
                          {failed.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                                ❌ Issues ({failed.length})
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {failed.map((c) => (
                                  <span key={c} style={{
                                    background: "rgba(239,68,68,0.1)",
                                    color: "#fca5a5",
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    fontSize: 12,
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
                                    background: "rgba(34,197,94,0.06)",
                                    color: "#86efac",
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    fontSize: 12,
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
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Helper to parse inline style string into React style object
function parseStyle(styleStr: string): Record<string, string> {
  const obj: Record<string, string> = {};
  styleStr.split(";").forEach((rule) => {
    const [key, value] = rule.split(":").map((s) => s.trim());
    if (key && value) {
      const camelKey = key.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
      obj[camelKey] = value;
    }
  });
  return obj;
}
