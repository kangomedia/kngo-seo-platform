"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Search, RefreshCw, Loader2 } from "lucide-react";

interface KeywordData {
  id: string;
  keyword: string;
  searchVolume: number;
  difficulty: number;
  group: string;
  targetUrl: string | null;
  snapshots: Array<{ position: number | null; previousPos: number | null }>;
}

export default function RankingsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        setKeywords(data.keywords || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  const groups = [...new Set(keywords.map((k) => k.group).filter(Boolean))];
  const filtered = keywords.filter((k) => {
    const matchesSearch = k.keyword.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = groupFilter === "all" || k.group === groupFilter;
    return matchesSearch && matchesGroup;
  });

  const page1Count = keywords.filter((k) => {
    const pos = k.snapshots?.[0]?.position;
    return pos != null && pos <= 10;
  }).length;

  const positions = keywords.map((k) => k.snapshots?.[0]?.position).filter((p): p is number => p != null);
  const avgPos = positions.length > 0 ? (positions.reduce((s, p) => s + p, 0) / positions.length).toFixed(1) : "—";

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;
  }

  return (
    <div className="max-w-6xl stagger">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Keywords</p>
          <p className="text-2xl font-extrabold">{keywords.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Page 1</p>
          <p className="text-2xl font-extrabold" style={{ color: "var(--success)" }}>{page1Count}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Avg Position</p>
          <p className="text-2xl font-extrabold">{avgPos}</p>
        </div>
        <div className="stat-card flex items-center justify-center">
          <button className="btn-primary w-full">
            <RefreshCw size={16} />
            Check Rankings
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input className="input-field pl-10" placeholder="Search keywords..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field" style={{ width: "auto", paddingRight: 32 }} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="all">All Groups</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Rankings Table */}
      {filtered.length === 0 ? (
        <div className="stat-card text-center py-12">
          <p className="text-lg font-bold mb-2">{search || groupFilter !== "all" ? "No matching keywords" : "No keywords tracked"}</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Keywords will appear here once rank tracking is set up</p>
        </div>
      ) : (
        <div className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Position</th>
                <th>Change</th>
                <th>Volume</th>
                <th>Difficulty</th>
                <th>Group</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((kw) => {
                const pos = kw.snapshots?.[0]?.position;
                const prev = kw.snapshots?.[0]?.previousPos;
                const change = pos != null && prev != null ? prev - pos : null;
                const posClass = pos ? pos <= 3 ? "position-good" : pos <= 10 ? "position-mid" : "position-bad" : "position-none";

                return (
                  <tr key={kw.id}>
                    <td><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{kw.keyword}</span></td>
                    <td><span className={`position-badge ${posClass}`}>{pos || "—"}</span></td>
                    <td>
                      {change != null && change !== 0 ? (
                        <span className="flex items-center gap-1 text-sm font-bold" style={{ color: change > 0 ? "var(--success)" : "var(--danger)" }}>
                          {change > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {change > 0 ? "+" : ""}{change}
                        </span>
                      ) : <Minus size={14} style={{ color: "var(--text-muted)" }} />}
                    </td>
                    <td>{kw.searchVolume?.toLocaleString() || "—"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="progress-bar flex-1" style={{ height: 3, maxWidth: 50 }}>
                          <div className="progress-bar-fill" style={{ width: `${kw.difficulty || 0}%`, background: (kw.difficulty || 0) > 60 ? "var(--danger)" : (kw.difficulty || 0) > 35 ? "#F59E0B" : "var(--success)" }} />
                        </div>
                        <span className="text-xs font-bold">{kw.difficulty || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs font-semibold px-2 py-1 rounded-md" style={{ background: "var(--bg-card-hover)" }}>
                        {kw.group || "—"}
                      </span>
                    </td>
                    <td><span className="text-xs" style={{ color: "var(--text-muted)" }}>{kw.targetUrl || "—"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
