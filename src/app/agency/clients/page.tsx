"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Plus, ChevronRight, TrendingUp, TrendingDown, X, Loader2, MoreVertical, Archive } from "lucide-react";

interface ClientData {
  id: string;
  name: string;
  domain: string | null;
  tier: string;
  metrics: {
    keywordsTracked: number;
    avgPosition: number;
    avgPositionChange: number;
    page1Keywords: number;
    healthScore: number;
  };
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
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>Client Name *</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mission AC & Heating" required />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>Domain</label>
            <input className="input-field" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. missionacheating.com" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>Tier</label>
            <select className="input-field" value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="STARTER">Starter</option>
              <option value="GROWTH">Growth</option>
              <option value="PRO">Pro</option>
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

function ArchiveConfirmModal({ clientName, onClose, onConfirm, archiving }: { clientName: string; onClose: () => void; onConfirm: () => void; archiving: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="stat-card w-full max-w-md" style={{ padding: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold">Archive Client</h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <Archive size={18} style={{ color: "#F59E0B", flexShrink: 0 }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Are you sure you want to archive <strong style={{ color: "var(--text-primary)" }}>{clientName}</strong>? They will be hidden from your dashboard but all data will be preserved.
          </p>
        </div>
        <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
          You can restore this client later from the database if needed.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} disabled={archiving} className="btn-primary" style={{ background: "#F59E0B" }}>
            {archiving ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
            {archiving ? "Archiving..." : "Archive Client"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientsListPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ClientData | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const fetchClients = () => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        setClients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/clients/${archiveTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (res.ok) {
        setClients((prev) => prev.filter((c) => c.id !== archiveTarget.id));
        setArchiveTarget(null);
      }
    } finally {
      setArchiving(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const handleClick = () => setOpenMenuId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openMenuId]);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.domain?.toLowerCase().includes(search.toLowerCase())
  );

  const tierColors: Record<string, string> = {
    STARTER: "tier-starter",
    GROWTH: "tier-growth",
    PRO: "tier-pro",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto stagger">
      {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} onCreated={fetchClients} />}
      {archiveTarget && <ArchiveConfirmModal clientName={archiveTarget.name} onClose={() => setArchiveTarget(null)} onConfirm={handleArchive} archiving={archiving} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">Clients</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {clients.length} active client{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Add Client
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
        <input
          className="input-field pl-10"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Client Table */}
      {filtered.length === 0 ? (
        <div className="stat-card text-center py-12">
          <p className="text-lg font-bold mb-2">{search ? "No matching clients" : "No clients yet"}</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {search ? "Try a different search term" : "Add your first client to get started"}
          </p>
        </div>
      ) : (
        <div className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Tier</th>
                <th>Keywords</th>
                <th>Page 1</th>
                <th>Avg Position</th>
                <th>Health</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold flex-shrink-0"
                        style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                      >
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          {client.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {client.domain || "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`tier-badge ${tierColors[client.tier] || "tier-starter"}`}>{client.tier}</span>
                  </td>
                  <td className="font-semibold">{client.metrics.keywordsTracked}</td>
                  <td>
                    <span className="font-bold" style={{ color: "var(--success)" }}>
                      {client.metrics.page1Keywords}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">{client.metrics.avgPosition || "—"}</span>
                      {client.metrics.avgPositionChange !== 0 && (
                        <span
                          className="text-xs font-bold flex items-center"
                          style={{ color: client.metrics.avgPositionChange < 0 ? "var(--success)" : "var(--danger)" }}
                        >
                          {client.metrics.avgPositionChange < 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(client.metrics.avgPositionChange)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="progress-bar flex-1" style={{ height: 4, maxWidth: 60 }}>
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${client.metrics.healthScore}%`,
                            background: client.metrics.healthScore >= 80 ? "var(--success)" : client.metrics.healthScore >= 60 ? "#F59E0B" : "var(--danger)",
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold">{client.metrics.healthScore}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/agency/clients/${client.id}`}
                        className="btn-secondary text-xs"
                        style={{ padding: "6px 12px" }}
                      >
                        View
                        <ChevronRight size={12} />
                      </Link>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === client.id ? null : client.id); }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === client.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl z-50"
                            style={{ background: "var(--card-bg)", border: "1px solid var(--border)", padding: 4 }}
                          >
                            <button
                              onClick={() => { setArchiveTarget(client); setOpenMenuId(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors"
                              style={{ color: "#F59E0B" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(245,158,11,0.08)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <Archive size={14} />
                              Archive Client
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
