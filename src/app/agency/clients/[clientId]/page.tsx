"use client";

import { useParams } from "next/navigation";
import {
  clients,
  keywordsByClient,
  deliverablesByClient,
  contentPlansByClient,
  getRankingTrend,
} from "@/lib/mock-data";
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
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

function MiniStat({
  label,
  value,
  change,
  positive,
}: {
  label: string;
  value: string | number;
  change?: string;
  positive?: boolean;
}) {
  return (
    <div className="stat-card">
      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      {change && (
        <p
          className="text-xs font-bold mt-1 flex items-center gap-1"
          style={{ color: positive ? "var(--success)" : "var(--danger)" }}
        >
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
  const client = clients.find((c) => c.id === clientId);
  const keywords = keywordsByClient[clientId] || [];
  const deliverables = deliverablesByClient[clientId] || [];
  const contentPlan = contentPlansByClient[clientId];
  const trendData = getRankingTrend(clientId);

  if (!client) return null;

  const m = client.metrics;
  const completedDeliverables = deliverables.filter((d) => d.status === "COMPLETED").length;
  const pendingApprovals = contentPlan?.pieces.filter((p) => p.status === "CLIENT_REVIEW").length || 0;

  // Top movers
  const topMovers = [...keywords]
    .filter((k) => k.change && k.change > 0)
    .sort((a, b) => (b.change || 0) - (a.change || 0))
    .slice(0, 5);

  return (
    <div className="max-w-6xl stagger">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MiniStat
          label="Page 1 Keywords"
          value={m.page1Keywords}
          change={`+${m.page1Change} this month`}
          positive
        />
        <MiniStat
          label="Avg. Position"
          value={m.avgPosition}
          change={`${m.avgPositionChange < 0 ? "↑" : "↓"} ${Math.abs(m.avgPositionChange)} positions`}
          positive={m.avgPositionChange < 0}
        />
        <MiniStat
          label="Keywords Tracked"
          value={m.keywordsTracked}
        />
        <MiniStat
          label="Health Score"
          value={`${m.healthScore}%`}
        />
      </div>

      {/* Chart + Top Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Ranking Trend Chart */}
        <div className="stat-card lg:col-span-2" style={{ padding: "20px 20px 10px" }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Ranking Trend (30 days)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="rankGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E34234" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#E34234" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#64748B" }}
                tickFormatter={(d) => new Date(d).getDate().toString()}
              />
              <YAxis
                reversed
                domain={["dataMin - 2", "dataMax + 2"]}
                tick={{ fontSize: 10, fill: "#64748B" }}
                label={{ value: "Position", angle: -90, position: "insideLeft", style: { fill: "#64748B", fontSize: 10 } }}
              />
              <Tooltip
                contentStyle={{
                  background: "#1A1F2E",
                  border: "1px solid #232939",
                  borderRadius: 10,
                  fontSize: 12,
                  fontFamily: "Montserrat",
                }}
                labelFormatter={(d) => `Date: ${d}`}
              />
              <Area
                type="monotone"
                dataKey="avgPosition"
                stroke="#E34234"
                strokeWidth={2}
                fill="url(#rankGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Movers */}
        <div className="stat-card" style={{ padding: "20px" }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            <TrendingUp size={14} className="inline mr-2" style={{ color: "var(--success)" }} />
            Top Movers
          </h3>
          <div className="flex flex-col gap-3">
            {topMovers.map((kw) => (
              <div key={kw.id} className="flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-3">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {kw.keyword}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    #{kw.position} · {kw.searchVolume.toLocaleString()} vol
                  </p>
                </div>
                <span
                  className="text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                  style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}
                >
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
        {/* Deliverables Progress */}
        <div className="stat-card" style={{ padding: "20px" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              <ListChecks size={14} className="inline mr-2" style={{ color: "var(--accent)" }} />
              Deliverables — April 2026
            </h3>
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              {completedDeliverables}/{deliverables.length} complete
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {deliverables.map((del) => (
              <div key={del.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {del.status === "COMPLETED" ? (
                      <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                    ) : del.status === "IN_PROGRESS" ? (
                      <Clock size={14} style={{ color: "#F59E0B" }} />
                    ) : (
                      <AlertCircle size={14} style={{ color: "var(--text-muted)" }} />
                    )}
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {del.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                    {del.currentCount}/{del.targetCount}
                  </span>
                </div>
                <div className="progress-bar" style={{ height: 3 }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${(del.currentCount / del.targetCount) * 100}%`,
                      background: del.status === "COMPLETED" ? "var(--success)" : "var(--accent)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Pipeline */}
        <div className="stat-card" style={{ padding: "20px" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              <FileText size={14} className="inline mr-2" style={{ color: "var(--accent)" }} />
              Content Pipeline
            </h3>
            {pendingApprovals > 0 && (
              <span
                className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}
              >
                {pendingApprovals} pending approval
              </span>
            )}
          </div>
          {contentPlan ? (
            <div className="flex flex-col gap-2">
              {contentPlan.pieces.slice(0, 6).map((piece) => {
                const typeIcon = piece.type === "BLOG_POST" ? "✍️" : piece.type === "GBP_POST" ? "📍" : "📢";
                const statusMap: Record<string, string> = {
                  PLANNED: "status-draft",
                  CLIENT_REVIEW: "status-review",
                  APPROVED: "status-approved",
                  WRITING: "status-review",
                  PUBLISHED: "status-published",
                  REJECTED: "status-rejected",
                };
                return (
                  <div
                    key={piece.id}
                    className="flex items-center gap-3 p-2 rounded-lg transition-colors"
                    style={{ background: "transparent" }}
                  >
                    <span className="text-sm">{typeIcon}</span>
                    <p className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {piece.title}
                    </p>
                    <span className={`status-badge ${statusMap[piece.status] || "status-draft"}`}>
                      {piece.status.replace("_", " ")}
                    </span>
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
