"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Globe,
  Building2,
  Tag,
  ExternalLink,
} from "lucide-react";

interface Competitor {
  id: string;
  domain: string;
  classification: string;
  reasoning: string | null;
  pillarSlug: string | null;
  isAccepted: boolean;
  source: string;
  domainRank: number | null;
  estTraffic: number | null;
  discoveredAt: string;
}

const CLASS_META: Record<
  string,
  { label: string; color: string; bg: string; intent: "good" | "neutral" | "bad" }
> = {
  PEER: { label: "Peer", color: "#22c55e", bg: "rgba(34,197,94,0.15)", intent: "good" },
  PLATFORM: { label: "Platform", color: "#94a3b8", bg: "rgba(148,163,184,0.15)", intent: "bad" },
  DIRECTORY: { label: "Directory", color: "#94a3b8", bg: "rgba(148,163,184,0.15)", intent: "bad" },
  MARKETPLACE: { label: "Marketplace", color: "#94a3b8", bg: "rgba(148,163,184,0.15)", intent: "bad" },
  TIER_MISMATCH: { label: "Tier mismatch", color: "#fbbf24", bg: "rgba(251,191,36,0.15)", intent: "neutral" },
  ADJACENT: { label: "Adjacent", color: "#60a5fa", bg: "rgba(96,165,250,0.15)", intent: "neutral" },
  IRRELEVANT: { label: "Irrelevant", color: "#94a3b8", bg: "rgba(148,163,184,0.10)", intent: "bad" },
};

export default function CompetitorPanel({ clientId }: { clientId: string }) {
  const [list, setList] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/competitors`);
      const data = await res.json();
      setList(data.competitors || []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const discover = async () => {
    setDiscovering(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/competitors/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 40 }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Discovery failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const toggle = async (id: string, isAccepted: boolean) => {
    await fetch(`/api/clients/${clientId}/competitors`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isAccepted }),
    });
    setList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isAccepted } : c))
    );
  };

  const peerCount = list.filter((c) => c.isAccepted && c.classification === "PEER").length;
  const totalCount = list.length;

  return (
    <div
      className="rounded-2xl p-5 mb-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.15)", color: "#7C3AED" }}
          >
            <Building2 size={16} />
          </div>
          <div>
            <h3 className="text-base font-extrabold">Competitor Intelligence</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {totalCount === 0
                ? "Run discovery to find peer agencies via SERP overlap + AI classification"
                : `${peerCount} peer${peerCount === 1 ? "" : "s"} accepted of ${totalCount} classified`}
            </p>
          </div>
        </div>
        <button
          onClick={discover}
          disabled={discovering}
          className="btn-primary inline-flex items-center gap-2 text-sm flex-shrink-0"
          style={{ opacity: discovering ? 0.6 : 1 }}
        >
          {discovering ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Discovering…
            </>
          ) : (
            <>
              <Sparkles size={14} />
              {totalCount === 0 ? "Discover Competitors" : "Re-run Discovery"}
            </>
          )}
        </button>
      </div>

      {error && (
        <div
          className="p-2.5 rounded-lg mb-3 text-xs"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : list.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center text-xs"
          style={{
            background: "var(--surface-elevated)",
            border: "1px dashed var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <Globe size={20} style={{ margin: "0 auto 6px", opacity: 0.5 }} />
          No competitors yet. Discovery uses DataForSEO SERP overlap + Claude classification — Wix/Yelp/GoDaddy get filtered out automatically.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((c) => {
            const meta = CLASS_META[c.classification] || {
              label: c.classification,
              color: "#94a3b8",
              bg: "rgba(148,163,184,0.15)",
              intent: "neutral" as const,
            };
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 p-2.5 rounded-lg"
                style={{
                  background: c.isAccepted
                    ? "rgba(34,197,94,0.04)"
                    : "var(--surface-elevated)",
                  border: `1px solid ${
                    c.isAccepted ? "rgba(34,197,94,0.25)" : "var(--border)"
                  }`,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://${c.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold truncate inline-flex items-center gap-1"
                      style={{ color: "var(--text-primary)", textDecoration: "none" }}
                    >
                      {c.domain}
                      <ExternalLink size={10} style={{ opacity: 0.5 }} />
                    </a>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-bold"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {c.pillarSlug && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded font-bold"
                        style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                      >
                        <Tag size={9} className="inline mr-0.5" />
                        {c.pillarSlug}
                      </span>
                    )}
                  </div>
                  {c.reasoning && (
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {c.reasoning}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggle(c.id, !c.isAccepted)}
                  className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold flex-shrink-0 transition-all"
                  style={{
                    background: c.isAccepted
                      ? "rgba(34,197,94,0.15)"
                      : "transparent",
                    color: c.isAccepted ? "#22c55e" : "var(--text-muted)",
                    border: `1px solid ${
                      c.isAccepted ? "rgba(34,197,94,0.3)" : "var(--border)"
                    }`,
                  }}
                  title={
                    c.isAccepted ? "Click to exclude" : "Click to include in research"
                  }
                >
                  {c.isAccepted ? (
                    <>
                      <CheckCircle2 size={11} />
                      Included
                    </>
                  ) : (
                    <>
                      <XCircle size={11} />
                      Excluded
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
