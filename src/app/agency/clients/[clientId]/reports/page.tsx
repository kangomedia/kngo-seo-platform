"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  FileBarChart,
  ExternalLink,
  Calendar,
  Loader2,
  Shield,
  Zap,
  BarChart3,
  ChevronDown,
  Copy,
  Check,
  Archive,
  ArchiveRestore,
  Trash2,
  X,
  Eye,
  EyeOff,
} from "lucide-react";

interface Report {
  id: string;
  uuid: string;
  type: string;
  title: string;
  summary: string;
  month: number;
  year: number;
  isPublished: boolean;
  isArchived: boolean;
  createdAt: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const reportTypeConfig: Record<string, {
  label: string;
  color: string;
  bg: string;
  icon: typeof FileBarChart;
}> = {
  MONTHLY: {
    label: "Monthly",
    color: "#3b82f6",
    bg: "#dbeafe",
    icon: BarChart3,
  },
  SITE_AUDIT: {
    label: "Site Audit",
    color: "#dc2626",
    bg: "#fee2e2",
    icon: Shield,
  },
  BASELINE: {
    label: "Baseline",
    color: "#7C3AED",
    bg: "#ede9fe",
    icon: Zap,
  },
};

export default function ReportsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Month/year selector state
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pendingType, setPendingType] = useState<"MONTHLY" | "SITE_AUDIT" | "BASELINE" | null>(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const fetchReports = async (archived = false) => {
    const url = `/api/clients/${clientId}/reports${archived ? "?archived=true" : ""}`;
    const r = await fetch(url);
    const data = await r.json();
    setReports(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports(showArchived);
  }, [clientId, showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openMonthPicker = (type: "MONTHLY" | "SITE_AUDIT" | "BASELINE") => {
    setPendingType(type);
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
    setShowMonthPicker(true);
    setShowDropdown(false);
  };

  const handleGenerate = async () => {
    if (!pendingType) return;
    setIsGenerating(true);
    setGeneratingType(pendingType);
    setShowMonthPicker(false);

    try {
      let res;
      if (pendingType === "MONTHLY") {
        res = await fetch(`/api/clients/${clientId}/reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: selectedMonth, year: selectedYear }),
        });
      } else {
        res = await fetch(`/api/clients/${clientId}/reports/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: pendingType, month: selectedMonth, year: selectedYear }),
        });
      }
      if (res.ok) {
        const newReport = await res.json();
        setReports((prev) => [newReport, ...prev]);
      }
    } catch {
      // Handle silently
    } finally {
      setIsGenerating(false);
      setGeneratingType("");
      setPendingType(null);
    }
  };

  const handleArchive = async (reportId: string, archive: boolean) => {
    const res = await fetch(`/api/clients/${clientId}/reports`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, isArchived: archive }),
    });
    if (res.ok) {
      if (showArchived) {
        // Update in place
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, isArchived: archive } : r))
        );
      } else {
        // Remove from view
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      }
    }
  };

  const handleDelete = async (reportId: string) => {
    const res = await fetch(`/api/clients/${clientId}/reports?reportId=${reportId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setDeleteConfirmId(null);
    }
  };

  const handleCopyLink = async (uuid: string) => {
    const url = `${window.location.origin}/report/${uuid}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(uuid);
    setTimeout(() => setCopiedId(null), 2000);
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
      <div className="flex items-center justify-between mb-6 relative z-50">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-extrabold">Client Reports</h2>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="btn-secondary text-xs flex items-center gap-1.5"
            style={{ padding: "5px 10px", opacity: showArchived ? 1 : 0.6 }}
            title={showArchived ? "Showing all reports (including archived)" : "Showing active reports only"}
          >
            {showArchived ? <Eye size={12} /> : <EyeOff size={12} />}
            {showArchived ? "All" : "Active"}
          </button>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            className="btn-primary text-sm flex items-center gap-2"
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating {generatingType === "SITE_AUDIT" ? "Audit" : generatingType === "BASELINE" ? "Baseline" : "Monthly"}...
              </>
            ) : (
              <>
                Generate Report
                <ChevronDown size={14} />
              </>
            )}
          </button>

          {showDropdown && (
            <div
              className="absolute right-0 mt-2 py-2 rounded-xl z-[100]"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
                minWidth: 240,
              }}
            >
              <button
                className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm transition-colors"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => openMonthPicker("SITE_AUDIT")}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "#fee2e2" }}
                >
                  <Shield size={16} style={{ color: "#dc2626" }} />
                </div>
                <div>
                  <p className="font-bold">Site Audit Report</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Technical health & issues
                  </p>
                </div>
              </button>
              <button
                className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm transition-colors"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => openMonthPicker("BASELINE")}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "#ede9fe" }}
                >
                  <Zap size={16} style={{ color: "#7C3AED" }} />
                </div>
                <div>
                  <p className="font-bold">Baseline Report</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Full SEO starting point
                  </p>
                </div>
              </button>
              <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
              <button
                className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm transition-colors"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => openMonthPicker("MONTHLY")}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "#dbeafe" }}
                >
                  <BarChart3 size={16} style={{ color: "#3b82f6" }} />
                </div>
                <div>
                  <p className="font-bold">Monthly Report</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Rankings & deliverables
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Month/Year Picker Modal ── */}
      {showMonthPicker && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMonthPicker(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 16, padding: 24,
              width: "100%", maxWidth: 380,
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Select Report Period
              </h3>
              <button
                onClick={() => setShowMonthPicker(false)}
                style={{
                  background: "transparent", border: "none",
                  cursor: "pointer", color: "var(--text-muted)",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Year selector */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setSelectedYear((y) => y - 1)}
                className="btn-secondary text-xs"
                style={{ padding: "6px 12px" }}
              >
                ←
              </button>
              <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {selectedYear}
              </span>
              <button
                onClick={() => setSelectedYear((y) => y + 1)}
                className="btn-secondary text-xs"
                style={{ padding: "6px 12px" }}
                disabled={selectedYear >= now.getFullYear()}
              >
                →
              </button>
            </div>

            {/* Month grid */}
            <div
              style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8, marginBottom: 20,
              }}
            >
              {MONTH_SHORT.map((m, idx) => {
                const monthNum = idx + 1;
                const isSelected = monthNum === selectedMonth;
                const isFuture = selectedYear === now.getFullYear() && monthNum > now.getMonth() + 1;

                return (
                  <button
                    key={m}
                    onClick={() => !isFuture && setSelectedMonth(monthNum)}
                    disabled={isFuture}
                    style={{
                      padding: "10px 0",
                      borderRadius: 8,
                      border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: isSelected ? "var(--accent-muted)" : "transparent",
                      color: isFuture ? "var(--text-muted)" : isSelected ? "var(--accent)" : "var(--text-primary)",
                      cursor: isFuture ? "not-allowed" : "pointer",
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      opacity: isFuture ? 0.4 : 1,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Generate button */}
            <button
              className="btn-primary w-full text-sm"
              style={{ padding: "10px 0" }}
              onClick={handleGenerate}
            >
              Generate {pendingType === "SITE_AUDIT" ? "Site Audit" : pendingType === "BASELINE" ? "Baseline" : "Monthly"} Report
              <span style={{ opacity: 0.7, marginLeft: 6 }}>
                — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmId && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmId(null);
          }}
        >
          <div
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 16, padding: 24,
              width: "100%", maxWidth: 340,
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 48, height: 48, borderRadius: 12,
                background: "rgba(239,68,68,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Trash2 size={22} style={{ color: "#ef4444" }} />
            </div>
            <h3
              className="text-lg font-bold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Delete Report?
            </h3>
            <p
              className="text-sm mb-5"
              style={{ color: "var(--text-muted)" }}
            >
              This action cannot be undone. The report and its shareable link will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                className="btn-secondary flex-1 text-sm"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 text-sm font-bold"
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  cursor: "pointer",
                }}
                onClick={() => handleDelete(deleteConfirmId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="stat-card text-center py-12">
          <FileBarChart
            size={40}
            style={{ color: "var(--text-muted)" }}
            className="mx-auto mb-4"
          />
          <p className="text-lg font-bold mb-2">
            {showArchived ? "No archived reports" : "No reports yet"}
          </p>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            {showArchived
              ? "Archived reports will appear here"
              : "Generate a Site Audit Report or Baseline Report to send to your client"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((report) => {
            const config = reportTypeConfig[report.type] || reportTypeConfig.MONTHLY;
            const Icon = config.icon;

            return (
              <div
                key={report.id}
                className="stat-card flex items-center gap-4"
                style={{
                  padding: "16px 20px",
                  opacity: report.isArchived ? 0.6 : 1,
                  transition: "opacity 0.2s ease",
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: config.bg, color: config.color }}
                >
                  <Icon size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4
                      className="text-sm font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {report.title}
                    </h4>
                    <span
                      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
                      style={{ background: config.bg, color: config.color }}
                    >
                      {config.label}
                    </span>
                    {report.isArchived && (
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
                        style={{
                          background: "rgba(156,163,175,0.15)",
                          color: "#9ca3af",
                        }}
                      >
                        Archived
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs flex items-center gap-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Calendar size={11} />
                    {MONTH_SHORT[report.month - 1]} {report.year}
                    {" · "}
                    {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {report.isPublished && (
                    <span className="status-badge status-published">
                      Published
                    </span>
                  )}
                  <button
                    onClick={() => handleCopyLink(report.uuid)}
                    className="btn-secondary text-xs"
                    style={{ padding: "6px 12px" }}
                    title="Copy shareable link"
                  >
                    {copiedId === report.uuid ? (
                      <>
                        <Check size={12} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copy Link
                      </>
                    )}
                  </button>
                  <a
                    href={`/report/${report.uuid}`}
                    target="_blank"
                    className="btn-secondary text-xs"
                    style={{ padding: "6px 12px" }}
                  >
                    <ExternalLink size={12} />
                    View
                  </a>
                  <button
                    onClick={() => handleArchive(report.id, !report.isArchived)}
                    className="btn-secondary text-xs"
                    style={{ padding: "6px 8px" }}
                    title={report.isArchived ? "Unarchive" : "Archive"}
                  >
                    {report.isArchived ? (
                      <ArchiveRestore size={14} />
                    ) : (
                      <Archive size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(report.id)}
                    className="btn-secondary text-xs"
                    style={{
                      padding: "6px 8px",
                      color: "#ef4444",
                      borderColor: "rgba(239,68,68,0.3)",
                    }}
                    title="Delete report"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
