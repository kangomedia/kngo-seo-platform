"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";

/* ─── Types ──────────────────────────────────────────── */

interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface DailyGSC {
  date: string;
  clicks: number;
  impressions: number;
}

interface GA4Overview {
  sessions: number;
  users: number;
  bounceRate: number;
  avgSessionDuration: number;
  pageViews: number;
}

interface TrafficSource {
  channel: string;
  sessions: number;
  users: number;
}

interface GA4Page {
  page: string;
  sessions: number;
  bounceRate: number;
}

interface DailyGA4 {
  date: string;
  sessions: number;
  users: number;
}

/* ─── Component ──────────────────────────────────────── */

export default function AnalyticsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;
  const justConnected = searchParams.get("connected") === "true";

  const [gscData, setGscData] = useState<{
    connected: boolean;
    property?: string;
    topQueries?: GSCQuery[];
    topPages?: GSCPage[];
    daily?: DailyGSC[];
  } | null>(null);

  const [gaData, setGaData] = useState<{
    connected: boolean;
    overview?: GA4Overview;
    trafficSources?: TrafficSource[];
    topPages?: GA4Page[];
    daily?: DailyGA4[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [gscRes, gaRes] = await Promise.allSettled([
      fetch(`/api/clients/${clientId}/search-console`),
      fetch(`/api/clients/${clientId}/analytics`),
    ]);

    if (gscRes.status === "fulfilled" && gscRes.value.ok) {
      const d = await gscRes.value.json();
      setGscData(d);
      if (d.connected) setGoogleConnected(true);
    } else if (gscRes.status === "fulfilled") {
      const d = await gscRes.value.json();
      setGscData(d);
    }

    if (gaRes.status === "fulfilled" && gaRes.value.ok) {
      const d = await gaRes.value.json();
      setGaData(d);
      if (d.connected) setGoogleConnected(true);
    } else if (gaRes.status === "fulfilled") {
      const d = await gaRes.value.json();
      setGaData(d);
    }

    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  const connectGoogle = () => {
    window.location.href = `/api/google/auth?clientId=${clientId}`;
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        Loading analytics data…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>
            📊 Analytics & Search Console
          </h1>
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>
            Google Analytics 4 + Search Console data
          </p>
        </div>
        {!googleConnected && (
          <button
            onClick={connectGoogle}
            style={{
              padding: "10px 20px",
              background: "linear-gradient(135deg, #4285f4, #34a853)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🔗 Connect Google Account
          </button>
        )}
      </div>

      {justConnected && (
        <div style={{
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 8,
          padding: 12,
          marginBottom: 24,
          color: "#86efac",
          fontSize: 14,
        }}>
          ✅ Google account connected! Configure GA4 Property ID and GSC Property in the client settings to start pulling data.
        </div>
      )}

      {!googleConnected && !justConnected && (
        <div style={{
          background: "#1f2937",
          borderRadius: 12,
          padding: 60,
          textAlign: "center",
          border: "1px solid #374151",
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
          <h3 style={{ color: "#e5e7eb", margin: "0 0 8px" }}>Connect Google Account</h3>
          <p style={{ color: "#9ca3af", fontSize: 14, maxWidth: 500, margin: "0 auto 20px" }}>
            Connect your Google account to pull Analytics and Search Console data.
            Make sure you have access to the client&apos;s GA4 property and Search Console site.
          </p>
          <button
            onClick={connectGoogle}
            style={{
              padding: "12px 28px",
              background: "linear-gradient(135deg, #4285f4, #34a853)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Connect Google Account
          </button>
        </div>
      )}

      {/* GA4 Section */}
      {gaData?.connected && gaData.overview && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ color: "#e5e7eb", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            📈 Google Analytics 4
          </h2>

          {/* Overview cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Sessions", value: gaData.overview.sessions.toLocaleString(), color: "#6366f1" },
              { label: "Users", value: gaData.overview.users.toLocaleString(), color: "#8b5cf6" },
              { label: "Bounce Rate", value: `${(gaData.overview.bounceRate * 100).toFixed(1)}%`, color: gaData.overview.bounceRate > 0.6 ? "#ef4444" : "#22c55e" },
              { label: "Avg Duration", value: `${Math.round(gaData.overview.avgSessionDuration)}s`, color: "#f59e0b" },
              { label: "Page Views", value: gaData.overview.pageViews.toLocaleString(), color: "#06b6d4" },
            ].map((c) => (
              <div key={c.label} style={{
                background: "#1f2937",
                borderRadius: 10,
                border: "1px solid #374151",
                padding: 16,
              }}>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Daily chart (simple bar visualization) */}
          {gaData.daily && gaData.daily.length > 0 && (
            <div style={{
              background: "#1f2937",
              borderRadius: 12,
              border: "1px solid #374151",
              padding: 20,
              marginBottom: 20,
            }}>
              <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
                Sessions (Last 30 Days)
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120 }}>
                {gaData.daily.map((d) => {
                  const maxSessions = Math.max(...(gaData.daily || []).map((dd) => dd.sessions));
                  const height = maxSessions > 0 ? (d.sessions / maxSessions) * 100 : 0;
                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.sessions} sessions`}
                      style={{
                        flex: 1,
                        height: `${Math.max(height, 2)}%`,
                        background: "linear-gradient(to top, #6366f1, #8b5cf6)",
                        borderRadius: "2px 2px 0 0",
                        minWidth: 4,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Traffic Sources + Top Pages */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Traffic Sources */}
            {gaData.trafficSources && (
              <div style={{
                background: "#1f2937",
                borderRadius: 12,
                border: "1px solid #374151",
                overflow: "hidden",
              }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #374151", color: "#e5e7eb", fontWeight: 600, fontSize: 14 }}>
                  Traffic Sources
                </div>
                {gaData.trafficSources.map((s) => (
                  <div key={s.channel} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 18px",
                    borderBottom: "1px solid #1a2332",
                  }}>
                    <span style={{ color: "#d1d5db", fontSize: 13 }}>{s.channel}</span>
                    <span style={{ color: "#9ca3af", fontSize: 13, fontWeight: 600 }}>{s.sessions}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Top Pages */}
            {gaData.topPages && (
              <div style={{
                background: "#1f2937",
                borderRadius: 12,
                border: "1px solid #374151",
                overflow: "hidden",
              }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #374151", color: "#e5e7eb", fontWeight: 600, fontSize: 14 }}>
                  Top Landing Pages
                </div>
                {gaData.topPages.slice(0, 10).map((p) => (
                  <div key={p.page} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 18px",
                    borderBottom: "1px solid #1a2332",
                    gap: 12,
                  }}>
                    <span style={{
                      color: "#d1d5db", fontSize: 13,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                    }}>{p.page}</span>
                    <span style={{ color: "#9ca3af", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                      {p.sessions} sessions
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GSC Section */}
      {gscData?.connected && (
        <div>
          <h2 style={{ color: "#e5e7eb", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            🔎 Search Console
          </h2>

          {/* Daily clicks chart */}
          {gscData.daily && gscData.daily.length > 0 && (
            <div style={{
              background: "#1f2937",
              borderRadius: 12,
              border: "1px solid #374151",
              padding: 20,
              marginBottom: 20,
            }}>
              <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
                Clicks (Last 30 Days)
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 100 }}>
                {gscData.daily.map((d) => {
                  const maxClicks = Math.max(...(gscData.daily || []).map((dd) => dd.clicks));
                  const height = maxClicks > 0 ? (d.clicks / maxClicks) * 100 : 0;
                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.clicks} clicks`}
                      style={{
                        flex: 1,
                        height: `${Math.max(height, 2)}%`,
                        background: "linear-gradient(to top, #22c55e, #4ade80)",
                        borderRadius: "2px 2px 0 0",
                        minWidth: 4,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Queries + Pages */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Top Queries */}
            {gscData.topQueries && (
              <div style={{
                background: "#1f2937",
                borderRadius: 12,
                border: "1px solid #374151",
                overflow: "hidden",
              }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #374151", color: "#e5e7eb", fontWeight: 600, fontSize: 14 }}>
                  Top Search Queries
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 60px 80px 60px 60px",
                  gap: 8,
                  padding: "8px 18px",
                  borderBottom: "1px solid #374151",
                  color: "#6b7280",
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  <span>Query</span>
                  <span style={{ textAlign: "right" }}>Clicks</span>
                  <span style={{ textAlign: "right" }}>Imprs</span>
                  <span style={{ textAlign: "right" }}>CTR</span>
                  <span style={{ textAlign: "right" }}>Pos</span>
                </div>
                {gscData.topQueries.map((q) => (
                  <div key={q.query} style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 60px 80px 60px 60px",
                    gap: 8,
                    padding: "8px 18px",
                    borderBottom: "1px solid #1a2332",
                    fontSize: 13,
                  }}>
                    <span style={{
                      color: "#d1d5db",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{q.query}</span>
                    <span style={{ color: "#22c55e", textAlign: "right", fontWeight: 600 }}>{q.clicks}</span>
                    <span style={{ color: "#9ca3af", textAlign: "right" }}>{q.impressions.toLocaleString()}</span>
                    <span style={{ color: "#9ca3af", textAlign: "right" }}>{(q.ctr * 100).toFixed(1)}%</span>
                    <span style={{ color: "#f59e0b", textAlign: "right", fontWeight: 600 }}>{q.position.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Top Pages */}
            {gscData.topPages && (
              <div style={{
                background: "#1f2937",
                borderRadius: 12,
                border: "1px solid #374151",
                overflow: "hidden",
              }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #374151", color: "#e5e7eb", fontWeight: 600, fontSize: 14 }}>
                  Top Pages by Clicks
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 60px 60px",
                  gap: 8,
                  padding: "8px 18px",
                  borderBottom: "1px solid #374151",
                  color: "#6b7280",
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  <span>Page</span>
                  <span style={{ textAlign: "right" }}>Clicks</span>
                  <span style={{ textAlign: "right" }}>Pos</span>
                </div>
                {gscData.topPages.slice(0, 10).map((p) => (
                  <div key={p.page} style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 60px 60px",
                    gap: 8,
                    padding: "8px 18px",
                    borderBottom: "1px solid #1a2332",
                    fontSize: 13,
                  }}>
                    <span style={{
                      color: "#d1d5db",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {p.page.replace(/^https?:\/\/[^/]+/, "")}
                    </span>
                    <span style={{ color: "#22c55e", textAlign: "right", fontWeight: 600 }}>{p.clicks}</span>
                    <span style={{ color: "#f59e0b", textAlign: "right" }}>{p.position.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Not configured notice */}
      {googleConnected && !gaData?.connected && !gscData?.connected && (
        <div style={{
          background: "#1f2937",
          borderRadius: 12,
          padding: 40,
          textAlign: "center",
          border: "1px solid #374151",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
          <h3 style={{ color: "#e5e7eb", margin: "0 0 8px" }}>Properties Not Configured</h3>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            Google is connected. Go to the client settings to select the GA4 Property ID and Search Console Property.
          </p>
        </div>
      )}
    </div>
  );
}
