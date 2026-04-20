"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  FileText,
  Activity,
  Users,
  Plus,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import { TIER_LABELS, TIER_COLORS } from "@/lib/tier-config";

interface ClientMetrics {
  id: string;
  name: string;
  domain: string | null;
  tier: string;
  metrics: {
    keywordsTracked: number;
    avgPosition: number;
    avgPositionChange: number;
    page1Keywords: number;
    page1Change: number;
    contentPublished: number;
    healthScore: number;
  };
}

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

function ClientCard({ client, index }: { client: ClientMetrics; index: number }) {
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
              {client.domain || "No domain set"}
            </p>
          </div>
          <span className={`tier-badge ${TIER_COLORS[client.tier] || "tier-starter"}`}>
            {TIER_LABELS[client.tier] || client.tier}
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
            <p className="text-lg font-extrabold flex items-center gap-1" style={{ color: client.metrics.avgPositionChange < 0 ? "var(--success)" : client.metrics.avgPositionChange > 0 ? "var(--danger)" : "var(--text-muted)" }}>
              {client.metrics.avgPositionChange < 0 ? "↑" : client.metrics.avgPositionChange > 0 ? "↓" : "—"}
              {client.metrics.avgPositionChange !== 0 ? Math.abs(client.metrics.avgPositionChange) : ""}
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

function AddClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [tier, setTier] = useState("STARTER");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, domain, tier }),
      });
      if (res.ok) {
        onCreated();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="stat-card w-full max-w-md" style={{ padding: 24 }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold">Add New Client</h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Client Name *
            </label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mission AC & Heating" required />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Domain
            </label>
            <input className="input-field" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. missionacheating.com" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Tier
            </label>
            <select className="input-field" value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="STARTER">Local Visibility — $400/mo</option>
              <option value="GROWTH">Growth SEO — $800/mo</option>
              <option value="PRO">Authority SEO — $1,500/mo</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end mt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || !name} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? "Creating..." : "Add Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AgencyDashboard() {
  const [clients, setClients] = useState<ClientMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchClients = () => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        setClients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Compute portfolio stats
  const totalKeywords = clients.reduce((sum, c) => sum + c.metrics.keywordsTracked, 0);
  const totalPage1 = clients.reduce((sum, c) => sum + c.metrics.page1Keywords, 0);
  const totalContent = clients.reduce((sum, c) => sum + c.metrics.contentPublished, 0);
  const avgHealth = clients.length > 0
    ? Math.round(clients.reduce((sum, c) => sum + c.metrics.healthScore, 0) / clients.length)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {showAddModal && (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onCreated={fetchClients}
        />
      )}

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-2">Portfolio Overview</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Managing {clients.length} clients · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
        <StatCard label="Total Keywords" value={totalKeywords} icon={<Target size={20} />} delay={0} />
        <StatCard label="Page 1 Rankings" value={totalPage1} icon={<BarChart3 size={20} />} delay={0.05} />
        <StatCard label="Content Published" value={totalContent} icon={<FileText size={20} />} delay={0.1} />
        <StatCard label="Avg Health Score" value={`${avgHealth}%`} icon={<Activity size={20} />} delay={0.15} />
      </div>

      {/* Client Grid */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold">Clients</h2>
        <button className="btn-primary text-sm" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="stat-card text-center py-12">
          <Users size={40} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p className="text-lg font-bold mb-2">No clients yet</p>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>Add your first client to get started</p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add Client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client, i) => (
            <ClientCard key={client.id} client={client} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
