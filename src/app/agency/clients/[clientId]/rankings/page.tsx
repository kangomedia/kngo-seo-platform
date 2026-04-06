"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  RefreshCw,
  Plus,
  X,
  Loader2,
  BarChart3,
} from "lucide-react";

interface KeywordData {
  id: string;
  keyword: string;
  searchVolume: number;
  difficulty: number;
  group: string;
  targetUrl: string | null;
  snapshots: Array<{
    position: number | null;
    previousPos: number | null;
  }>;
}

export default function RankingsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  // Add Keywords modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeywords, setNewKeywords] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addResult, setAddResult] = useState("");

  // Rank checking
  const [isCheckingRanks, setIsCheckingRanks] = useState(false);
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const loadKeywords = () => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        setKeywords(data.keywords || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadKeywords();
  }, [clientId]);

  const groups = [
    ...new Set(keywords.map((k) => k.group).filter(Boolean)),
  ];
  const filtered = keywords.filter((k) => {
    const matchesSearch = k.keyword
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesGroup =
      groupFilter === "all" || k.group === groupFilter;
    return matchesSearch && matchesGroup;
  });

  const page1Count = keywords.filter((k) => {
    const pos = k.snapshots?.[0]?.position;
    return pos != null && pos <= 10;
  }).length;

  const positions = keywords
    .map((k) => k.snapshots?.[0]?.position)
    .filter((p): p is number => p != null);
  const avgPos =
    positions.length > 0
      ? (positions.reduce((s, p) => s + p, 0) / positions.length).toFixed(1)
      : "—";

  // Total search volume
  const totalVolume = keywords.reduce((s, k) => s + (k.searchVolume || 0), 0);

  const handleAddKeywords = async () => {
    if (!newKeywords.trim()) return;
    setIsAdding(true);
    setAddResult("");

    const keywordList = newKeywords
      .split("\n")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    try {
      const res = await fetch(`/api/clients/${clientId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: keywordList,
          group: newGroup.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAddResult(data.message);
        setNewKeywords("");
        setNewGroup("");
        setLoading(true);
        loadKeywords();
        setTimeout(() => {
          setShowAddModal(false);
          setAddResult("");
        }, 1500);
      } else {
        setAddResult(data.error || "Failed to add keywords");
      }
    } catch {
      setAddResult("Network error — please try again");
    } finally {
      setIsAdding(false);
    }
  };

  const handleCheckRankings = async () => {
    setIsCheckingRanks(true);
    setActionMessage("");

    try {
      const res = await fetch(`/api/clients/${clientId}/rankings/check`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setActionMessage(`Checked ${data.checked} of ${data.total} keywords`);
        setLoading(true);
        loadKeywords();
      } else {
        setActionMessage(data.error || "Failed to check rankings");
      }
    } catch {
      setActionMessage("Network error — please try again");
    } finally {
      setIsCheckingRanks(false);
      setTimeout(() => setActionMessage(""), 4000);
    }
  };

  const handleRefreshMetrics = async () => {
    setIsRefreshingMetrics(true);
    setActionMessage("");

    try {
      const res = await fetch(`/api/clients/${clientId}/keywords/metrics`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setActionMessage(`Updated metrics for ${data.updated} keywords`);
        setLoading(true);
        loadKeywords();
      } else {
        setActionMessage(data.error || "Failed to refresh metrics");
      }
    } catch {
      setActionMessage("Network error — please try again");
    } finally {
      setIsRefreshingMetrics(false);
      setTimeout(() => setActionMessage(""), 4000);
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
    <div className="max-w-6xl stagger">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="stat-card">
          <p
            className="text-xs font-bold uppercase tracking-wide mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Keywords
          </p>
          <p className="text-2xl font-extrabold">{keywords.length}</p>
        </div>
        <div className="stat-card">
          <p
            className="text-xs font-bold uppercase tracking-wide mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Page 1
          </p>
          <p
            className="text-2xl font-extrabold"
            style={{ color: "var(--success)" }}
          >
            {page1Count}
          </p>
        </div>
        <div className="stat-card">
          <p
            className="text-xs font-bold uppercase tracking-wide mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Avg Position
          </p>
          <p className="text-2xl font-extrabold">{avgPos}</p>
        </div>
        <div className="stat-card">
          <p
            className="text-xs font-bold uppercase tracking-wide mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Total Volume
          </p>
          <p className="text-2xl font-extrabold">
            {totalVolume > 0 ? totalVolume.toLocaleString() : "—"}
          </p>
        </div>
        <div className="stat-card flex items-center gap-2 justify-center">
          <button
            className="btn-primary flex-1 text-sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={handleCheckRankings}
          disabled={isCheckingRanks || keywords.length === 0}
          className="btn-secondary text-sm"
          style={{ opacity: keywords.length === 0 ? 0.5 : 1 }}
        >
          {isCheckingRanks ? (
            <><Loader2 size={14} className="animate-spin" /> Checking...</>
          ) : (
            <><RefreshCw size={14} /> Check Rankings</>
          )}
        </button>
        <button
          onClick={handleRefreshMetrics}
          disabled={isRefreshingMetrics || keywords.length === 0}
          className="btn-secondary text-sm"
          style={{ opacity: keywords.length === 0 ? 0.5 : 1 }}
        >
          {isRefreshingMetrics ? (
            <><Loader2 size={14} className="animate-spin" /> Refreshing...</>
          ) : (
            <><BarChart3 size={14} /> Refresh Metrics</>
          )}
        </button>

        {actionMessage && (
          <span
            className="flex items-center text-xs font-bold px-3 py-1 rounded-lg"
            style={{
              background: actionMessage.includes("error") || actionMessage.includes("Failed")
                ? "rgba(239,68,68,0.1)"
                : "rgba(16,185,129,0.1)",
              color: actionMessage.includes("error") || actionMessage.includes("Failed")
                ? "var(--danger)"
                : "var(--success)",
            }}
          >
            {actionMessage}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            className="input-field pl-10"
            placeholder="Search keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field"
          style={{ width: "auto", paddingRight: 32 }}
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="all">All Groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {/* Rankings Table */}
      {filtered.length === 0 ? (
        <div className="stat-card text-center py-12">
          <p className="text-lg font-bold mb-2">
            {search || groupFilter !== "all"
              ? "No matching keywords"
              : "No keywords tracked"}
          </p>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            {search || groupFilter !== "all"
              ? "Try a different search or filter"
              : "Add keywords to start tracking your SEO rankings"}
          </p>
          {!search && groupFilter === "all" && (
            <button
              className="btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={16} />
              Add Keywords
            </button>
          )}
        </div>
      ) : (
        <div
          className="stat-card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Position</th>
                <th>Change</th>
                <th>Volume</th>
                <th>Difficulty</th>
                <th>Group</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((kw) => {
                const pos = kw.snapshots?.[0]?.position;
                const prev = kw.snapshots?.[0]?.previousPos;
                const change =
                  pos != null && prev != null ? prev - pos : null;
                const posClass = pos
                  ? pos <= 3
                    ? "position-good"
                    : pos <= 10
                    ? "position-mid"
                    : "position-bad"
                  : "position-none";

                return (
                  <tr key={kw.id}>
                    <td>
                      <span
                        className="font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {kw.keyword}
                      </span>
                    </td>
                    <td>
                      <span className={`position-badge ${posClass}`}>
                        {pos || "—"}
                      </span>
                    </td>
                    <td>
                      {change != null && change !== 0 ? (
                        <span
                          className="flex items-center gap-1 text-sm font-bold"
                          style={{
                            color:
                              change > 0
                                ? "var(--success)"
                                : "var(--danger)",
                          }}
                        >
                          {change > 0 ? (
                            <TrendingUp size={14} />
                          ) : (
                            <TrendingDown size={14} />
                          )}
                          {change > 0 ? "+" : ""}
                          {change}
                        </span>
                      ) : (
                        <Minus
                          size={14}
                          style={{ color: "var(--text-muted)" }}
                        />
                      )}
                    </td>
                    <td>
                      <span className="font-semibold" style={{ color: kw.searchVolume ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {kw.searchVolume ? kw.searchVolume.toLocaleString() : "—"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          className="progress-bar flex-1"
                          style={{ height: 3, maxWidth: 50 }}
                        >
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${kw.difficulty || 0}%`,
                              background:
                                (kw.difficulty || 0) > 60
                                  ? "var(--danger)"
                                  : (kw.difficulty || 0) > 35
                                  ? "#F59E0B"
                                  : "var(--success)",
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold">
                          {kw.difficulty || "—"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded-md"
                        style={{
                          background: "var(--bg-card-hover)",
                        }}
                      >
                        {kw.group || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Keywords Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div
            className="stat-card w-full max-w-lg mx-4 animate-fade-in"
            style={{ padding: 24, maxHeight: "80vh", overflow: "auto" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold">Add Keywords</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-white/5"
              >
                <X size={20} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            <div className="mb-4">
              <label
                className="text-xs font-bold uppercase tracking-wide mb-2 block"
                style={{ color: "var(--text-muted)" }}
              >
                Keywords (one per line)
              </label>
              <textarea
                className="input-field"
                rows={8}
                placeholder={`ac repair denver\nfurnace installation cost\nhvac maintenance near me\nair conditioning service`}
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                style={{ resize: "vertical" }}
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {newKeywords.split("\n").filter((k) => k.trim()).length}{" "}
                keywords · Search volume will be fetched automatically
              </p>
            </div>

            <div className="mb-4">
              <label
                className="text-xs font-bold uppercase tracking-wide mb-2 block"
                style={{ color: "var(--text-muted)" }}
              >
                Group (optional)
              </label>
              <input
                className="input-field"
                placeholder="e.g. Core Services, Locations, etc."
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
              />
            </div>

            {addResult && (
              <div
                className="p-3 rounded-lg mb-4"
                style={{
                  background: addResult.includes("Added")
                    ? "rgba(16,185,129,0.1)"
                    : "rgba(239,68,68,0.1)",
                  border: addResult.includes("Added")
                    ? "1px solid rgba(16,185,129,0.2)"
                    : "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: addResult.includes("Added")
                      ? "var(--success)"
                      : "var(--danger)",
                  }}
                >
                  {addResult}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleAddKeywords}
                disabled={
                  isAdding ||
                  !newKeywords
                    .split("\n")
                    .some((k) => k.trim().length > 0)
                }
                className="btn-primary flex-1"
                style={{
                  opacity: !newKeywords
                    .split("\n")
                    .some((k) => k.trim().length > 0)
                    ? 0.5
                    : 1,
                }}
              >
                {isAdding ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Add Keywords
                  </>
                )}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
