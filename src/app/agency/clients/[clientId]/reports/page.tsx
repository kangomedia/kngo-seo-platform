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
  createdAt: string;
}

const months = [
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/reports`)
      .then((r) => r.json())
      .then((data) => {
        setReports(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

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

  const handleGenerate = async (type: "MONTHLY" | "SITE_AUDIT" | "BASELINE") => {
    setIsGenerating(true);
    setGeneratingType(type);
    setShowDropdown(false);
    try {
      let res;
      if (type === "MONTHLY") {
        // Use existing monthly endpoint
        res = await fetch(`/api/clients/${clientId}/reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } else {
        res = await fetch(`/api/clients/${clientId}/reports/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-extrabold">Client Reports</h2>
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
              className="absolute right-0 mt-2 py-2 rounded-xl z-50"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                minWidth: 240,
              }}
            >
              <button
                className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm transition-colors"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => handleGenerate("SITE_AUDIT")}
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
                onClick={() => handleGenerate("BASELINE")}
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
                onClick={() => handleGenerate("MONTHLY")}
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

      {reports.length === 0 ? (
        <div className="stat-card text-center py-12">
          <FileBarChart
            size={40}
            style={{ color: "var(--text-muted)" }}
            className="mx-auto mb-4"
          />
          <p className="text-lg font-bold mb-2">No reports yet</p>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Generate a Site Audit Report or Baseline Report to send to your client
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
                style={{ padding: "16px 20px" }}
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
                  </div>
                  <p
                    className="text-xs flex items-center gap-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Calendar size={11} />
                    {months[report.month - 1]} {report.year}
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
