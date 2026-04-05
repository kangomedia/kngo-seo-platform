"use client";

import Link from "next/link";
import { clients } from "@/lib/mock-data";
import { Search, Plus, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";

export default function ClientsListPage() {
  const [search, setSearch] = useState("");

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.domain?.toLowerCase().includes(search.toLowerCase())
  );

  const tierColors: Record<string, string> = {
    STARTER: "tier-starter",
    GROWTH: "tier-growth",
    PRO: "tier-pro",
  };

  return (
    <div className="max-w-5xl mx-auto stagger">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">Clients</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {clients.length} active clients
          </p>
        </div>
        <button className="btn-primary">
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
                        {client.domain}
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`tier-badge ${tierColors[client.tier]}`}>{client.tier}</span>
                </td>
                <td className="font-semibold">{client.metrics.keywordsTracked}</td>
                <td>
                  <span className="font-bold" style={{ color: "var(--success)" }}>
                    {client.metrics.page1Keywords}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{client.metrics.avgPosition}</span>
                    <span
                      className="text-xs font-bold flex items-center"
                      style={{ color: client.metrics.avgPositionChange < 0 ? "var(--success)" : "var(--danger)" }}
                    >
                      {client.metrics.avgPositionChange < 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {Math.abs(client.metrics.avgPositionChange)}
                    </span>
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
                  <Link
                    href={`/agency/clients/${client.id}`}
                    className="btn-secondary text-xs"
                    style={{ padding: "6px 12px" }}
                  >
                    View
                    <ChevronRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
