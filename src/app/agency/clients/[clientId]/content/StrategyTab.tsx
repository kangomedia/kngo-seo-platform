"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  CheckCircle2,
  Sparkles,
  Layers,
  Zap,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface MapPiece {
  id: string;
  type: string;
  title: string;
  keyword?: string;
  description?: string;
  funnelStage?: "TOFU" | "MOFU" | "BOFU";
  monthIndex?: number;
  priority?: number;
  promoted?: boolean;
  contentPieceId?: string;
  reason?: string;
  pillarSlug?: string;
}

interface MapPillar {
  slug: string;
  title: string;
  description?: string;
  targetKeyword?: string;
  pieces: MapPiece[];
}

interface MapData {
  pillars?: MapPillar[];
  quickWins?: MapPiece[];
  monthlyFocus?: Record<string, string>;
}

interface ActiveMap {
  id: string;
  title: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  aiSummary: string | null;
  mapData: MapData | null;
}

const FUNNEL_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  TOFU: { bg: "rgba(59,130,246,0.15)", fg: "#60a5fa", label: "TOFU · Awareness" },
  MOFU: { bg: "rgba(245,158,11,0.15)", fg: "#fbbf24", label: "MOFU · Comparison" },
  BOFU: { bg: "rgba(34,197,94,0.15)", fg: "#4ade80", label: "BOFU · Intent" },
};

export default function StrategyTab({
  clientId,
  onPromoted,
}: {
  clientId: string;
  onPromoted?: () => void;
}) {
  const [map, setMap] = useState<ActiveMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [funnelFilter, setFunnelFilter] = useState<"ALL" | "TOFU" | "MOFU" | "BOFU">("ALL");
  const [monthFilter, setMonthFilter] = useState<number | "ALL">("ALL");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [hasNewerResearch, setHasNewerResearch] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mapRes, researchRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/content-map/active`),
        fetch(`/api/clients/${clientId}/research`),
      ]);
      if (mapRes.ok) {
        const data = await mapRes.json();
        setMap(data.map);
        if (data.map?.mapData?.pillars?.[0]) {
          setExpandedPillar(data.map.mapData.pillars[0].slug);
        }
        // Detect stale-map condition: if there's a KeywordResearch row
        // created AFTER the active map's createdAt, the map doesn't reflect
        // it yet — surface a "newer research available" indicator.
        if (researchRes.ok && data.map?.createdAt) {
          const research = await researchRes.json();
          const mapCreated = new Date(data.map.createdAt).getTime();
          const newer = (research || []).some(
            (r: { createdAt: string }) =>
              new Date(r.createdAt).getTime() > mapCreated
          );
          setHasNewerResearch(newer);
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const regenerate = async () => {
    setRegenerating(true);
    setRegenError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/content-map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Empty body → the endpoint folds in ALL recent research sessions
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }

      // The endpoint streams NDJSON. The work can run 60–180s; without
      // streaming the response, Cloudflare returns 524 before Claude finishes.
      // We read line-by-line until we see a {type:"done"} or {type:"error"}.
      if (!res.body) throw new Error("No response body from server");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finalEvent: { type: string; message?: string } | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "done" || msg.type === "error") {
              finalEvent = msg;
            }
          } catch {
            /* ignore malformed line */
          }
        }
      }
      if (!finalEvent) {
        throw new Error("Server closed connection before finishing");
      }
      if (finalEvent.type === "error") {
        throw new Error(finalEvent.message || "Regeneration failed");
      }

      await load();
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const promote = async (pieceId: string) => {
    if (!map) return;
    setPromoting(pieceId);
    setError("");
    try {
      const res = await fetch(
        `/api/clients/${clientId}/content-map/promote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mapId: map.id, pieceId }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Promotion failed");
      }
      await load();
      if (onPromoted) onPromoted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promotion failed");
    } finally {
      setPromoting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (!map || !map.mapData) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <Sparkles size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
        <h3 className="text-lg font-extrabold mb-2">No active content strategy yet</h3>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Run keyword research, then generate a content map to build the 6-month topical authority plan.
        </p>
        <a
          href={`/agency/clients/${clientId}/research`}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          Open Research <ExternalLink size={14} />
        </a>
      </div>
    );
  }

  const { pillars = [], quickWins = [], monthlyFocus = {} } = map.mapData;

  const allPieces: MapPiece[] = [
    ...pillars.flatMap((p) => p.pieces || []),
    ...quickWins,
  ];
  const totalCount = allPieces.length;
  const promotedCount = allPieces.filter((p) => p.promoted).length;
  const isBroken = pillars.length === 0 && quickWins.length === 0;

  const filterPiece = (p: MapPiece) => {
    if (funnelFilter !== "ALL" && p.funnelStage !== funnelFilter) return false;
    if (monthFilter !== "ALL" && p.monthIndex !== monthFilter) return false;
    return true;
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div
        className="rounded-2xl p-5 mb-4"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.10), rgba(16,185,129,0.05))",
          border: "1px solid rgba(124,58,237,0.25)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Layers size={16} style={{ color: "#7C3AED" }} />
              <h3 className="text-lg font-extrabold">{map.title}</h3>
              <span
                className="text-[10px] px-2 py-0.5 rounded font-bold"
                style={{ background: "rgba(124,58,237,0.15)", color: "#7C3AED" }}
              >
                Generated {new Date(map.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {pillars.length} pillars · {totalCount} pieces · {promotedCount} promoted
              {totalCount > 0 && ` (${Math.round((promotedCount / totalCount) * 100)}%)`}
            </p>
            {map.aiSummary && (
              <p className="text-sm mt-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {map.aiSummary}
              </p>
            )}
          </div>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold flex-shrink-0 transition-all"
            style={{
              background: "#7C3AED",
              color: "#fff",
              opacity: regenerating ? 0.6 : 1,
              cursor: regenerating ? "wait" : "pointer",
            }}
            title="Regenerate the content strategy by folding in ALL of this client's keyword research sessions"
          >
            {regenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Regenerating…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Regenerate Strategy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stale-map banner */}
      {hasNewerResearch && !regenerating && (
        <div
          className="rounded-xl p-3 mb-4 flex items-start gap-2 text-sm"
          style={{
            background: "rgba(251,191,36,0.10)",
            border: "1px solid rgba(251,191,36,0.30)",
            color: "var(--text-primary)",
          }}
        >
          <span style={{ flex: 1 }}>
            <strong>Newer research available.</strong> You&apos;ve run keyword research after this strategy was generated. Click <strong>Regenerate Strategy</strong> to fold in the new data — pillar selection will refresh.
          </span>
        </div>
      )}

      {regenError && (
        <div
          className="rounded-xl p-3 mb-4 text-sm"
          style={{
            background: "rgba(239,68,68,0.10)",
            border: "1px solid rgba(239,68,68,0.30)",
            color: "var(--danger)",
          }}
        >
          {regenError}
        </div>
      )}

      {isBroken && !regenerating && (
        <div
          className="rounded-xl p-3 mb-4 flex items-start gap-2 text-sm"
          style={{
            background: "rgba(239,68,68,0.10)",
            border: "1px solid rgba(239,68,68,0.30)",
            color: "var(--text-primary)",
          }}
        >
          <span style={{ flex: 1 }}>
            <strong>This strategy didn&apos;t generate any pillars or quick wins.</strong> The previous attempt likely hit a token limit mid-output. Click <strong>Regenerate Strategy</strong> above to try again.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs font-bold uppercase tracking-wide self-center mr-1" style={{ color: "var(--text-muted)" }}>
          Funnel:
        </span>
        {(["ALL", "TOFU", "MOFU", "BOFU"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFunnelFilter(f)}
            className="px-3 py-1 rounded-full text-xs font-bold transition-all"
            style={{
              background:
                funnelFilter === f
                  ? f === "ALL"
                    ? "var(--accent-muted)"
                    : FUNNEL_COLORS[f].bg
                  : "transparent",
              color:
                funnelFilter === f
                  ? f === "ALL"
                    ? "var(--accent)"
                    : FUNNEL_COLORS[f].fg
                  : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {f}
          </button>
        ))}
        <span className="text-xs font-bold uppercase tracking-wide self-center mx-2" style={{ color: "var(--text-muted)" }}>
          Month:
        </span>
        <button
          onClick={() => setMonthFilter("ALL")}
          className="px-3 py-1 rounded-full text-xs font-bold transition-all"
          style={{
            background: monthFilter === "ALL" ? "var(--accent-muted)" : "transparent",
            color: monthFilter === "ALL" ? "var(--accent)" : "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          All
        </button>
        {[1, 2, 3, 4, 5, 6].map((m) => (
          <button
            key={m}
            onClick={() => setMonthFilter(m)}
            className="px-3 py-1 rounded-full text-xs font-bold transition-all"
            style={{
              background: monthFilter === m ? "var(--accent-muted)" : "transparent",
              color: monthFilter === m ? "var(--accent)" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
            title={monthlyFocus[String(m)] || ""}
          >
            M{m}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="p-3 rounded-lg mb-4 text-sm"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} style={{ color: "#22c55e" }} />
            <h4 className="text-base font-extrabold">Quick Wins</h4>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              · low competition, high intent
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {quickWins.filter(filterPiece).map((q) => (
              <PieceRow
                key={q.id}
                piece={q}
                onPromote={() => promote(q.id)}
                promoting={promoting === q.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pillars */}
      {pillars.map((pillar) => {
        const visible = (pillar.pieces || []).filter(filterPiece);
        const isExpanded = expandedPillar === pillar.slug;
        const pillarPromoted = (pillar.pieces || []).filter((p) => p.promoted).length;
        return (
          <div
            key={pillar.slug}
            className="rounded-2xl mb-3 overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <button
              onClick={() =>
                setExpandedPillar(isExpanded ? null : pillar.slug)
              }
              className="w-full p-4 flex items-start justify-between gap-3 text-left"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {isExpanded ? (
                  <ChevronDown size={18} style={{ color: "var(--text-muted)", marginTop: 2 }} />
                ) : (
                  <ChevronRight size={18} style={{ color: "var(--text-muted)", marginTop: 2 }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold truncate">{pillar.title}</h4>
                    {pillar.targetKeyword && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                      >
                        {pillar.targetKeyword}
                      </span>
                    )}
                  </div>
                  {pillar.description && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {pillar.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                {pillarPromoted} / {pillar.pieces?.length || 0} promoted
              </div>
            </button>
            {isExpanded && (
              <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
                {visible.length === 0 ? (
                  <p
                    className="text-xs py-4 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No pieces match the current filter.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {visible.map((p) => (
                      <PieceRow
                        key={p.id}
                        piece={p}
                        onPromote={() => promote(p.id)}
                        promoting={promoting === p.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Monthly focus footer */}
      {Object.keys(monthlyFocus).length > 0 && (
        <div
          className="rounded-2xl p-5 mt-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h4 className="text-sm font-extrabold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
            6-Month Theme
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(monthlyFocus)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([m, focus]) => (
                <div
                  key={m}
                  className="p-3 rounded-xl"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
                >
                  <p className="text-[10px] font-bold uppercase" style={{ color: "var(--accent)" }}>
                    Month {m}
                  </p>
                  <p className="text-sm font-semibold mt-1">{focus}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PieceRow({
  piece,
  onPromote,
  promoting,
}: {
  piece: MapPiece;
  onPromote: () => void;
  promoting: boolean;
}) {
  const funnel = piece.funnelStage
    ? FUNNEL_COLORS[piece.funnelStage]
    : null;
  const monthLabel = piece.monthIndex ? `M${piece.monthIndex}` : null;
  return (
    <div
      className="p-3 rounded-xl flex items-start gap-3"
      style={{
        background: piece.promoted ? "rgba(34,197,94,0.06)" : "var(--surface-elevated)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight">{piece.title}</p>
        {piece.keyword && (
          <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
            🎯 {piece.keyword}
          </p>
        )}
        {piece.description && (
          <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {piece.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mt-2">
          {funnel && (
            <span
              className="text-[10px] px-2 py-0.5 rounded font-bold"
              style={{ background: funnel.bg, color: funnel.fg }}
            >
              {funnel.label}
            </span>
          )}
          {monthLabel && (
            <span
              className="text-[10px] px-2 py-0.5 rounded font-bold"
              style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
            >
              {monthLabel}
            </span>
          )}
          <span
            className="text-[10px] px-2 py-0.5 rounded font-bold"
            style={{ background: "var(--surface-muted)", color: "var(--text-muted)" }}
          >
            {piece.type.replace("_", " ")}
          </span>
        </div>
      </div>
      <div className="flex-shrink-0">
        {piece.promoted ? (
          <span
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
          >
            <CheckCircle2 size={12} />
            Scheduled
          </span>
        ) : (
          <button
            onClick={onPromote}
            disabled={promoting}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: "var(--accent)",
              color: "#fff",
              opacity: promoting ? 0.6 : 1,
              cursor: promoting ? "wait" : "pointer",
            }}
          >
            {promoting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Promote
          </button>
        )}
      </div>
    </div>
  );
}
