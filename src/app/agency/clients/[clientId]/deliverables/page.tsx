"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Plus,
  Loader2,
  X,
} from "lucide-react";

interface Deliverable {
  id: string;
  name: string;
  targetCount: number;
  currentCount: number;
  status: string;
  month: number;
  year: number;
}

export default function DeliverablesPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("4");
  const [isAdding, setIsAdding] = useState(false);

  const loadData = () => {
    fetch(`/api/clients/${clientId}/deliverables`)
      .then((r) => r.json())
      .then((data) => {
        setDeliverables(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [clientId]);

  const handleStatusUpdate = async (
    deliverableId: string,
    newStatus: string,
    currentCount?: number
  ) => {
    const res = await fetch(`/api/clients/${clientId}/deliverables`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliverableId, status: newStatus, currentCount }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDeliverables((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
    }
  };

  const handleAddDeliverable = async () => {
    if (!newName.trim() || !newTarget) return;
    setIsAdding(true);

    try {
      const res = await fetch(`/api/clients/${clientId}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          targetCount: parseInt(newTarget, 10),
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setDeliverables((prev) => [...prev, created]);
        setNewName("");
        setNewTarget("4");
        setShowAddModal(false);
      }
    } catch {
      // Handle error silently
    } finally {
      setIsAdding(false);
    }
  };

  const completed = deliverables.filter(
    (d) => d.status === "COMPLETED"
  ).length;
  const total = deliverables.length;
  const overallPct = total ? Math.round((completed / total) * 100) : 0;

  // Group deliverables by month/year for summary
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentDeliverables = deliverables.filter(
    (d) => d.month === currentMonth && d.year === currentYear
  );
  const summaryBreakdown = currentDeliverables
    .map((d) => `${d.currentCount}/${d.targetCount} ${d.name}`)
    .join(" · ");

  const statusConfig: Record<
    string,
    { icon: React.ReactNode; color: string; label: string }
  > = {
    PENDING: {
      icon: <AlertCircle size={16} />,
      color: "var(--text-muted)",
      label: "Pending",
    },
    IN_PROGRESS: {
      icon: <Clock size={16} />,
      color: "#F59E0B",
      label: "In Progress",
    },
    COMPLETED: {
      icon: <CheckCircle2 size={16} />,
      color: "var(--success)",
      label: "Completed",
    },
    OVERDUE: {
      icon: <AlertTriangle size={16} />,
      color: "var(--danger)",
      label: "Overdue",
    },
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
    <div className="max-w-4xl stagger">
      {/* Summary */}
      <div className="stat-card mb-6" style={{ padding: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold">Deliverables</h2>
            <p
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {months[currentMonth - 1]} {currentYear}: {summaryBreakdown || `${completed} of ${total} complete`} · {overallPct}%
            </p>
          </div>
          <button
            className="btn-primary text-sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            Add Deliverable
          </button>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${overallPct}%`,
              background:
                overallPct === 100
                  ? "var(--success)"
                  : "linear-gradient(90deg, var(--accent), var(--accent-hover))",
            }}
          />
        </div>
      </div>

      {deliverables.length === 0 ? (
        <div className="stat-card text-center py-12">
          <p className="text-lg font-bold mb-2">No deliverables yet</p>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Add deliverables manually, or generate a content plan to
            auto-create them.
          </p>
          <button
            className="btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            Add Deliverable
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {deliverables.map((del) => {
            const pct = Math.round(
              (del.currentCount / del.targetCount) * 100
            );
            const config =
              statusConfig[del.status] || statusConfig.PENDING;

            return (
              <div
                key={del.id}
                className="stat-card flex items-center gap-4"
                style={{ padding: "16px 20px" }}
              >
                <button
                  onClick={() => {
                    const nextStatus =
                      del.status === "PENDING"
                        ? "IN_PROGRESS"
                        : del.status === "IN_PROGRESS"
                        ? "COMPLETED"
                        : "PENDING";
                    const nextCount =
                      nextStatus === "COMPLETED"
                        ? del.targetCount
                        : del.currentCount;
                    handleStatusUpdate(del.id, nextStatus, nextCount);
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
                  style={{
                    background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
                    color: config.color,
                  }}
                  title={`Click to change status (${del.status})`}
                >
                  {config.icon}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4
                      className="text-sm font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {del.name}
                    </h4>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-md ml-2"
                      style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}
                    >
                      {months[del.month - 1]} {del.year}
                    </span>
                    <span
                      className="text-xs font-bold"
                      style={{ color: config.color }}
                    >
                      {del.currentCount}/{del.targetCount}
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: 4 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background:
                          del.status === "COMPLETED"
                            ? "var(--success)"
                            : "var(--accent)",
                      }}
                    />
                  </div>
                </div>
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
      )}

      {/* Add Deliverable Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div
            className="stat-card w-full max-w-md mx-4 animate-fade-in"
            style={{ padding: 24 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold">
                Add Deliverable
              </h3>
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
                Deliverable Name
              </label>
              <input
                className="input-field"
                placeholder="e.g. Blog Posts, GBP Posts, Technical Audit"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="mb-6">
              <label
                className="text-xs font-bold uppercase tracking-wide mb-2 block"
                style={{ color: "var(--text-muted)" }}
              >
                Target Count
              </label>
              <input
                className="input-field"
                type="number"
                min={1}
                max={100}
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddDeliverable}
                disabled={isAdding || !newName.trim()}
                className="btn-primary flex-1"
                style={{ opacity: !newName.trim() ? 0.5 : 1 }}
              >
                {isAdding ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Add Deliverable
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
