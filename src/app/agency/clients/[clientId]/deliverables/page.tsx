"use client";

import { useParams } from "next/navigation";
import { deliverablesByClient, clients } from "@/lib/mock-data";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Plus,
} from "lucide-react";

export default function DeliverablesPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const deliverables = deliverablesByClient[clientId] || [];
  const client = clients.find((c) => c.id === clientId);

  const completed = deliverables.filter((d) => d.status === "COMPLETED").length;
  const total = deliverables.length;
  const overallPct = total ? Math.round((completed / total) * 100) : 0;

  const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    PENDING: { icon: <AlertCircle size={16} />, color: "var(--text-muted)", label: "Pending" },
    IN_PROGRESS: { icon: <Clock size={16} />, color: "#F59E0B", label: "In Progress" },
    COMPLETED: { icon: <CheckCircle2 size={16} />, color: "var(--success)", label: "Completed" },
    OVERDUE: { icon: <AlertTriangle size={16} />, color: "var(--danger)", label: "Overdue" },
  };

  return (
    <div className="max-w-4xl stagger">
      {/* Summary */}
      <div className="stat-card mb-6" style={{ padding: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold">April 2026 Deliverables</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {completed} of {total} deliverables complete · {overallPct}%
            </p>
          </div>
          <button className="btn-primary text-sm">
            <Plus size={16} />
            Add Deliverable
          </button>
        </div>

        {/* Overall Progress */}
        <div className="progress-bar" style={{ height: 8 }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${overallPct}%`,
              background: overallPct === 100
                ? "var(--success)"
                : `linear-gradient(90deg, var(--accent), var(--accent-hover))`,
            }}
          />
        </div>
      </div>

      {/* Deliverable Items */}
      <div className="flex flex-col gap-3">
        {deliverables.map((del) => {
          const pct = Math.round((del.currentCount / del.targetCount) * 100);
          const config = statusConfig[del.status];

          return (
            <div
              key={del.id}
              className="stat-card flex items-center gap-4"
              style={{ padding: "16px 20px" }}
            >
              {/* Status Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
                  color: config.color,
                }}
              >
                {config.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    {del.name}
                  </h4>
                  <span className="text-xs font-bold" style={{ color: config.color }}>
                    {del.currentCount}/{del.targetCount}
                  </span>
                </div>
                <div className="progress-bar" style={{ height: 4 }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: del.status === "COMPLETED" ? "var(--success)" : "var(--accent)",
                    }}
                  />
                </div>
              </div>

              {/* Status Badge */}
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full flex-shrink-0"
                style={{
                  background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
                  color: config.color,
                }}
              >
                {config.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
