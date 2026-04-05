"use client";

import Link from "next/link";
import { clients, getPortfolioStats } from "@/lib/mock-data";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  FileText,
  Activity,
  ArrowUpRight,
  Users,
  ChevronRight,
} from "lucide-react";

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "var(--success)" : score >= 60 ? "#F59E0B" : "var(--danger)";
  return (
    <div className="progress-bar" style={{ height: 4 }}>
      <div
        className="progress-bar-fill"
        style={{ width: `${score}%`, background: color }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  icon,
  delay,
}: {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  delay: number;
}) {
  const isPositive = change && change > 0;
  return (
    <div
      className="stat-card animate-fade-in"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
        >
          {icon}
        </div>
        {change !== undefined && (
          <div className="flex items-center gap-1" style={{ color: isPositive ? "var(--success)" : "var(--danger)", fontSize: 13, fontWeight: 700 }}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isPositive ? "+" : ""}{change}
          </div>
        )}
      </div>
      <p className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function ClientCard({ client, index }: { client: typeof clients[0]; index: number }) {
  const tierColors: Record<string, string> = {
    STARTER: "tier-starter",
    GROWTH: "tier-growth",
    PRO: "tier-pro",
  };

  return (
    <Link
      href={`/agency/clients/${client.id}`}
      className="stat-card block animate-fade-in group"
      style={{ animationDelay: `${0.1 + index * 0.05}s`, padding: 0, overflow: "hidden" }}
    >
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              {client.name}
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {client.domain}
            </p>
          </div>
          <span className={`tier-badge ${tierColors[client.tier]}`}>
            {client.tier}
          </span>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
              {client.metrics.page1Keywords}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Page 1
            </p>
          </div>
          <div>
            <p className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
              {client.metrics.keywordsTracked}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Keywords
            </p>
          </div>
          <div>
            <p className="text-lg font-extrabold flex items-center gap-1" style={{ color: client.metrics.avgPositionChange < 0 ? "var(--success)" : "var(--danger)" }}>
              {client.metrics.avgPositionChange < 0 ? "↑" : "↓"}
              {Math.abs(client.metrics.avgPositionChange)}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Avg Pos Δ
            </p>
          </div>
        </div>

        {/* Health Score */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
            Health Score
          </span>
          <span className="text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>
            {client.metrics.healthScore}%
          </span>
        </div>
        <HealthBar score={client.metrics.healthScore} />
      </div>

      {/* Footer */}
      <div
        className="px-5 py-3 flex items-center justify-between transition-colors"
        style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card-hover)" }}
      >
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          View details
        </span>
        <ChevronRight
          size={14}
          className="transition-transform group-hover:translate-x-1"
          style={{ color: "var(--accent)" }}
        />
      </div>
    </Link>
  );
}

export default function AgencyDashboard() {
  const stats = getPortfolioStats();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-2">Portfolio Overview</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Managing {stats.clientCount} clients · April 2026
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
        <StatCard
          label="Total Keywords"
          value={stats.totalKeywords}
          icon={<Target size={20} />}
          delay={0}
        />
        <StatCard
          label="Page 1 Rankings"
          value={stats.totalPage1}
          change={14}
          icon={<BarChart3 size={20} />}
          delay={0.05}
        />
        <StatCard
          label="Content Published"
          value={stats.totalContent}
          icon={<FileText size={20} />}
          delay={0.1}
        />
        <StatCard
          label="Avg Health Score"
          value={`${stats.avgHealth}%`}
          icon={<Activity size={20} />}
          delay={0.15}
        />
      </div>

      {/* Client Grid */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold">Clients</h2>
        <button className="btn-primary text-sm">
          <Users size={16} />
          Add Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client, i) => (
          <ClientCard key={client.id} client={client} index={i} />
        ))}
      </div>
    </div>
  );
}
