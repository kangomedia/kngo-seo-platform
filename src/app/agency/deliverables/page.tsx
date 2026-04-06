"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, AlertCircle, AlertTriangle, Loader2 } from "lucide-react";

interface ClientDeliverable {
  id: string;
  name: string;
  domain: string | null;
  deliverables: {
    id: string;
    name: string;
    targetCount: number;
    currentCount: number;
    status: string;
    month: number;
    year: number;
  }[];
}

export default function CrossClientDeliverables() {
  const [data, setData] = useState<ClientDeliverable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch clients with their deliverables
    fetch("/api/clients")
      .then((r) => r.json())
      .then(async (clients) => {
        const withDeliverables = await Promise.all(
          clients.map(async (client: { id: string; name: string; domain: string | null }) => {
            const res = await fetch(`/api/clients/${client.id}/deliverables`);
            const deliverables = await res.json();
            return { id: client.id, name: client.name, domain: client.domain, deliverables };
          })
        );
        setData(withDeliverables);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleStatusUpdate = async (clientId: string, deliverableId: string, newStatus: string, currentCount?: number) => {
    const res = await fetch(`/api/clients/${clientId}/deliverables`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliverableId, status: newStatus, currentCount }),
    });

    if (res.ok) {
      // Refresh that client's deliverables
      const updated = await fetch(`/api/clients/${clientId}/deliverables`);
      const newDeliverables = await updated.json();
      setData((prev) =>
        prev.map((d) => (d.id === clientId ? { ...d, deliverables: newDeliverables } : d))
      );
    }
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
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold mb-1">Deliverables</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Cross-client view · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {data.length === 0 || data.every((d) => d.deliverables.length === 0) ? (
        <div className="stat-card text-center py-12">
          <p className="text-lg font-bold mb-2">No deliverables yet</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Deliverables will appear here once clients have been set up
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {data.map(({ id: clientId, name, deliverables }) => {
            if (deliverables.length === 0) return null;
            const completed = deliverables.filter((d: { status: string }) => d.status === "COMPLETED").length;
            const pct = Math.round((completed / deliverables.length) * 100);

            return (
              <div key={clientId} className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
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
                      {name.charAt(0)}
                    </div>
                    <div>
                      <Link
                        href={`/agency/clients/${clientId}`}
                        className="text-sm font-bold hover:underline"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {name}
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
                    {deliverables.map((del: { id: string; status: string; name: string; currentCount: number; targetCount: number }) => {
                      const statusIcon =
                        del.status === "COMPLETED" ? <CheckCircle2 size={14} style={{ color: "var(--success)" }} /> :
                        del.status === "IN_PROGRESS" ? <Clock size={14} style={{ color: "#F59E0B" }} /> :
                        del.status === "OVERDUE" ? <AlertTriangle size={14} style={{ color: "var(--danger)" }} /> :
                        <AlertCircle size={14} style={{ color: "var(--text-muted)" }} />;

                      return (
                        <button
                          key={del.id}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors text-left"
                          style={{ background: "transparent" }}
                          onClick={() => {
                            // Cycle: PENDING → IN_PROGRESS → COMPLETED
                            const nextStatus =
                              del.status === "PENDING" ? "IN_PROGRESS" :
                              del.status === "IN_PROGRESS" ? "COMPLETED" :
                              del.status === "COMPLETED" ? "PENDING" : "IN_PROGRESS";
                            const nextCount = nextStatus === "COMPLETED" ? del.targetCount : del.currentCount;
                            handleStatusUpdate(clientId, del.id, nextStatus, nextCount);
                          }}
                          title={`Click to change status (${del.status})`}
                        >
                          {statusIcon}
                          <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                            {del.name}
                          </span>
                          <span className="text-[10px] font-bold ml-auto" style={{ color: "var(--text-muted)" }}>
                            {del.currentCount}/{del.targetCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
