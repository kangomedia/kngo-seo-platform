"use client";

import { clients, deliverablesByClient } from "@/lib/mock-data";
import Link from "next/link";
import { CheckCircle2, Clock, AlertCircle, AlertTriangle } from "lucide-react";

export default function CrossClientDeliverables() {
  const allDeliverables = clients.map((client) => ({
    client,
    deliverables: deliverablesByClient[client.id] || [],
  }));

  return (
    <div className="max-w-5xl mx-auto stagger">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold mb-1">Deliverables</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Cross-client view · April 2026
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {allDeliverables.map(({ client, deliverables }) => {
          if (deliverables.length === 0) return null;
          const completed = deliverables.filter((d) => d.status === "COMPLETED").length;
          const pct = Math.round((completed / deliverables.length) * 100);

          return (
            <div key={client.id} className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Client Header */}
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold"
                    style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                  >
                    {client.name.charAt(0)}
                  </div>
                  <div>
                    <Link
                      href={`/agency/clients/${client.id}/deliverables`}
                      className="text-sm font-bold hover:underline"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {client.name}
                    </Link>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {completed}/{deliverables.length} complete
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="progress-bar" style={{ width: 100, height: 4 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: pct === 100 ? "var(--success)" : "var(--accent)",
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Deliverable Items */}
              <div className="px-5 py-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {deliverables.map((del) => {
                    const statusIcon =
                      del.status === "COMPLETED" ? <CheckCircle2 size={14} style={{ color: "var(--success)" }} /> :
                      del.status === "IN_PROGRESS" ? <Clock size={14} style={{ color: "#F59E0B" }} /> :
                      del.status === "OVERDUE" ? <AlertTriangle size={14} style={{ color: "var(--danger)" }} /> :
                      <AlertCircle size={14} style={{ color: "var(--text-muted)" }} />;

                    return (
                      <div key={del.id} className="flex items-center gap-2">
                        {statusIcon}
                        <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {del.name}
                        </span>
                        <span className="text-[10px] font-bold ml-auto" style={{ color: "var(--text-muted)" }}>
                          {del.currentCount}/{del.targetCount}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
