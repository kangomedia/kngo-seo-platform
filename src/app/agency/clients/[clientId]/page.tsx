"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  FileText,
  ListChecks,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface ClientDetail {
  id: string;
  name: string;
  keywords: Array<{
    id: string;
    keyword: string;
    searchVolume: number;
    difficulty: number;
    group: string;
    snapshots: Array<{ position: number | null; previousPos: number | null; checkedAt: string }>;
  }>;
  contentPlans: Array<{
    id: string;
    month: number;
    year: number;
    title: string;
    pieces: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      keyword: string;
      status: string;
      approval: { outcome: string; notes?: string } | null;
    }>;
  }>;
  deliverables: Array<{
    id: string;
    name: string;
    targetCount: number;
    currentCount: number;
    status: string;
    month: number;
    year: number;
  }>;
}

function MiniStat({ label, value, change, positive }: { label: string; value: string | number; change?: string; positive?: boolean }) {
  return (
    <div className="stat-card">
      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>{value}</p>
      {change && (
        <p className="text-xs font-bold mt-1 flex items-center gap-1" style={{ color: positive ? "var(--success)" : "var(--danger)" }}>
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change}
        </p>
      )}
    </div>
  );
}

export default function ClientOverview() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [data, setData] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;
  }
  if (!data) return <p style={{ color: "var(--text-muted)" }}>Error loading client data</p>;

  // Compute metrics
  const keywords = data.keywords || [];
  const latestPositions = keywords.map((kw) => kw.snapshots?.[0]?.position).filter((p): p is number => p != null);
  const page1Keywords = latestPositions.filter((p) => p <= 10).length;
  const avgPosition = latestPositions.length > 0
    ? (latestPositions.reduce((a, b) => a + b, 0) / latestPositions.length).toFixed(1)
    : "—";

  // Position changes
  const posChanges = keywords.map((kw) => {
    const s = kw.snapshots?.[0];
    if (s?.position && s?.previousPos) return s.previousPos - s.position;
    return null;
  }).filter((c): c is number => c !== null);
  const avgChange = posChanges.length > 0
    ? (posChanges.reduce((a, b) => a + b, 0) / posChanges.length).toFixed(1)
    : 0;

  // Health
  const deliverables = data.deliverables || [];
  const completedDel = deliverables.filter((d) => d.status === "COMPLETED").length;
  const healthPct = deliverables.length > 0 ? Math.round((completedDel / deliverables.length) * 100) : 50;

  // Top movers
  const topMovers = keywords
    .map((kw) => {
      const change = kw.snapshots?.[0]?.previousPos && kw.snapshots?.[0]?.position
        ? kw.snapshots[0].previousPos - kw.snapshots[0].position
        : 0;
      return { ...kw, change, position: kw.snapshots?.[0]?.position || null };
    })
    .filter((k) => k.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 5);

  // Content plan
  const currentPlan = data.contentPlans?.[0];
  const pendingApprovals = currentPlan?.pieces.filter((p) => p.status === "CLIENT_REVIEW").length || 0;

  // Generate mock trend (will be real data once DataForSEO is wired)
  const trendData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2026, 2, 7 + i).toISOString().split("T")[0],
    avgPosition: Math.max(1, Math.round(((Number(avgPosition) || 20) - (i / 30) * 4 + Math.sin(i * 0.3) * 2) * 10) / 10),
  }));

  return (
    <div className="max-w-6xl stagger">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MiniStat label="Page 1 Keywords" value={page1Keywords} change={`${page1Keywords} on page 1`} positive />
        <MiniStat label="Avg. Position" value={avgPosition} change={Number(avgChange) > 0 ? `↑ ${avgChange} positions` : undefined} positive={Number(avgChange) > 0} />
        <MiniStat label="Keywords Tracked" value={keywords.length} />
        <MiniStat label="Health Score" value={`${healthPct}%`} />
      </div>

      {/* Chart + Top Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="stat-card lg:col-span-2" style={{ padding: "20px 20px 10px" }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>Ranking Trend (30 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="rankGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E34234" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#E34234" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} tickFormatter={(d) => new Date(d).getDate().toString()} />
              <YAxis reversed domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 10, fill: "#64748B" }} />
              <Tooltip contentStyle={{ background: "#1A1F2E", border: "1px solid #232939", borderRadius: 10, fontSize: 12 }} />
              <Area type="monotone" dataKey="avgPosition" stroke="#E34234" strokeWidth={2} fill="url(#rankGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card" style={{ padding: "20px" }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            <TrendingUp size={14} className="inline mr-2" style={{ color: "var(--success)" }} />
            Top Movers
          </h3>
          <div className="flex flex-col gap-3">
            {topMovers.map((kw) => (
              <div key={kw.id} className="flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-3">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{kw.keyword}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>#{kw.position} · {kw.searchVolume?.toLocaleString()} vol</p>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}>
                  <TrendingUp size={12} />+{kw.change}
                </span>
              </div>
            ))}
            {topMovers.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No ranking improvements yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Deliverables + Content Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card" style={{ padding: "20px" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              <ListChecks size={14} className="inline mr-2" style={{ color: "var(--accent)" }} />
              Deliverables
            </h3>
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              {completedDel}/{deliverables.length} complete
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {deliverables.slice(0, 6).map((del) => (
              <div key={del.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {del.status === "COMPLETED" ? <CheckCircle2 size={14} style={{ color: "var(--success)" }} /> : del.status === "IN_PROGRESS" ? <Clock size={14} style={{ color: "#F59E0B" }} /> : <AlertCircle size={14} style={{ color: "var(--text-muted)" }} />}
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{del.name}</span>
                  </div>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{del.currentCount}/{del.targetCount}</span>
                </div>
                <div className="progress-bar" style={{ height: 3 }}>
                  <div className="progress-bar-fill" style={{ width: `${(del.currentCount / del.targetCount) * 100}%`, background: del.status === "COMPLETED" ? "var(--success)" : "var(--accent)" }} />
                </div>
              </div>
            ))}
            {deliverables.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No deliverables set up yet</p>}
          </div>
        </div>

        <div className="stat-card" style={{ padding: "20px" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              <FileText size={14} className="inline mr-2" style={{ color: "var(--accent)" }} />
              Content Pipeline
            </h3>
            {pendingApprovals > 0 && (
              <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                {pendingApprovals} pending approval
              </span>
            )}
          </div>
          {currentPlan ? (
            <div className="flex flex-col gap-2">
              {currentPlan.pieces.slice(0, 6).map((piece) => {
                const typeIcon = piece.type === "BLOG_POST" ? "✍️" : piece.type === "GBP_POST" ? "📍" : "📢";
                const statusMap: Record<string, string> = { PLANNED: "status-draft", CLIENT_REVIEW: "status-review", APPROVED: "status-approved", WRITING: "status-review", PUBLISHED: "status-published", REJECTED: "status-rejected" };
                return (
                  <div key={piece.id} className="flex items-center gap-3 p-2 rounded-lg">
                    <span className="text-sm">{typeIcon}</span>
                    <p className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{piece.title}</p>
                    <span className={`status-badge ${statusMap[piece.status] || "status-draft"}`}>{piece.status.replace("_", " ")}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No content plan for this month</p>
          )}
        </div>
      </div>
    </div>
  );
}
