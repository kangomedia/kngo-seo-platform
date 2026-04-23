"use client";

import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
  FileText,
  Printer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";

interface Issue {
  key: string;
  label: string;
  description?: string | null;
}

interface PageData {
  url: string;
  statusCode: number | null;
  title: string | null;
  wordCount: number;
  onpageScore: number | null;
  issueCount: number;
  issues: Issue[];
  topRecommendation: string | null;
}

interface TopIssue {
  key: string;
  label: string;
  count: number;
  severity: string;
  description?: string | null;
}

interface AuditReportData {
  clientName: string;
  domain: string | null;
  generatedAt: string;
  auditDate?: string;
  hasAuditData: boolean;
  healthScore: number | null;
  pagesCount: number;
  totalIssueTypes: number;
  criticalCount: number;
  warningCount: number;
  pagesWithIssues: number;
  perfectPages: number;
  topIssues: TopIssue[];
  pages: PageData[];
  worstPages: PageData[];
  bestPages: PageData[];
  highlights: string[];
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#f59e0b";
  return "#dc2626";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "#dcfce7";
  if (score >= 60) return "#fef3c7";
  return "#fee2e2";
}

const severityConfig = {
  critical: { color: "#dc2626", bg: "#fee2e2", icon: XCircle, label: "Critical" },
  warning: { color: "#f59e0b", bg: "#fef3c7", icon: AlertTriangle, label: "Warning" },
  info: { color: "#3b82f6", bg: "#dbeafe", icon: Info, label: "Info" },
};

export default function SiteAuditReport({ data }: { data: AuditReportData }) {
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [showAllPages, setShowAllPages] = useState(false);

  const togglePage = (url: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  if (!data.hasAuditData) {
    return (
      <div style={{ background: "#F5F5F5", minHeight: "100vh" }}>
        <ReportHeader clientName={data.clientName} subtitle="Site Audit Report" />
        <div className="max-w-3xl mx-auto px-6 py-12 text-center">
          <Shield size={48} className="mx-auto mb-4" style={{ color: "#ccc" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "#222" }}>
            No Audit Data Available
          </h2>
          <p className="text-sm" style={{ color: "#888" }}>
            Run a site audit first to generate this report.
          </p>
        </div>
      </div>
    );
  }

  const displayPages = showAllPages ? data.pages : data.pages.slice(0, 10);

  return (
    <div style={{ background: "#F5F5F5", minHeight: "100vh" }}>
      <ReportHeader clientName={data.clientName} subtitle="Site Audit Report" />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Health Score Hero */}
        <div
          className="rounded-2xl p-8 mb-6 -mt-6 relative z-10 text-center"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E4E4E4",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "#888" }}
          >
            Website Health Score
          </p>
          {data.healthScore != null ? (
            <>
              <div
                className="w-32 h-32 rounded-full mx-auto flex items-center justify-center mb-4"
                style={{
                  background: getScoreBg(data.healthScore),
                  border: `4px solid ${getScoreColor(data.healthScore)}`,
                }}
              >
                <span
                  className="text-4xl font-extrabold"
                  style={{ color: getScoreColor(data.healthScore) }}
                >
                  {Math.round(data.healthScore)}
                </span>
              </div>
              <p className="text-sm font-semibold" style={{ color: getScoreColor(data.healthScore) }}>
                {data.healthScore >= 80
                  ? "Good Health"
                  : data.healthScore >= 60
                  ? "Needs Improvement"
                  : "Needs Attention"}
              </p>
            </>
          ) : (
            <div
              className="w-32 h-32 rounded-full mx-auto flex items-center justify-center mb-4"
              style={{ background: "#f1f5f9", border: "4px solid #cbd5e1" }}
            >
              <span className="text-4xl font-extrabold" style={{ color: "#94a3b8" }}>
                —
              </span>
            </div>
          )}
          {data.auditDate && (
            <p className="text-xs mt-3" style={{ color: "#aaa" }}>
              Crawled {new Date(data.auditDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Pages Crawled" value={data.pagesCount} />
          <StatCard label="Issue Types" value={data.totalIssueTypes} color="#dc2626" />
          <StatCard label="Pages Clean" value={data.perfectPages} color="#16a34a" />
          <StatCard label="Pages w/ Issues" value={data.pagesWithIssues} color="#f59e0b" />
        </div>

        {/* Top Issues */}
        {data.topIssues.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2 className="text-lg font-extrabold mb-1 flex items-center gap-2" style={{ color: "#222" }}>
              <AlertCircle size={20} style={{ color: "#dc2626" }} />
              Top Issues Found
            </h2>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              Issues found across {data.pagesCount} crawled pages, ordered by frequency
            </p>
            <div className="flex flex-col gap-3">
              {data.topIssues.map((issue) => {
                const config = severityConfig[issue.severity as keyof typeof severityConfig] || severityConfig.info;
                const Icon = config.icon;
                return (
                  <div
                    key={issue.key}
                    className="p-4 rounded-xl"
                    style={{ background: "#FAFAFA" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: config.bg }}
                      >
                        <Icon size={16} style={{ color: config.color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: "#222" }}>
                          {issue.label}
                        </p>
                        <p className="text-xs" style={{ color: "#888" }}>
                          {config.label} · Found on {issue.count} page{issue.count > 1 ? "s" : ""}
                        </p>
                      </div>
                      <span
                        className="text-xs font-bold px-3 py-1 rounded-lg"
                        style={{ background: config.bg, color: config.color }}
                      >
                        {issue.count}
                      </span>
                    </div>
                    {issue.description && (
                      <p
                        className="text-xs leading-relaxed mt-2 ml-11"
                        style={{ color: "#666" }}
                      >
                        {issue.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Page-by-Page Analysis */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <h2 className="text-lg font-extrabold mb-1 flex items-center gap-2" style={{ color: "#222" }}>
            <FileText size={20} style={{ color: "#3b82f6" }} />
            Page-by-Page Analysis
          </h2>
          <p className="text-sm mb-4" style={{ color: "#888" }}>
            Showing {displayPages.length} of {data.pages.length} pages
          </p>
          <div className="flex flex-col gap-2">
            {displayPages.map((page) => {
              const isExpanded = expandedPages.has(page.url);
              const urlPath = (() => {
                try {
                  return new URL(page.url).pathname;
                } catch {
                  return page.url;
                }
              })();

              return (
                <div key={page.url}>
                  <div
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                    style={{ background: isExpanded ? "#F0F4FF" : "#FAFAFA" }}
                    onClick={() => togglePage(page.url)}
                  >
                    {/* Score badge */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0"
                      style={{
                        background: page.onpageScore != null ? getScoreBg(page.onpageScore) : "#f1f5f9",
                        color: page.onpageScore != null ? getScoreColor(page.onpageScore) : "#94a3b8",
                      }}
                    >
                      {page.onpageScore != null ? Math.round(page.onpageScore) : "—"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#222" }}>
                        {page.title || urlPath}
                      </p>
                      <p className="text-xs truncate" style={{ color: "#888" }}>
                        {urlPath}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {page.issueCount > 0 ? (
                        <span
                          className="text-xs font-bold px-2 py-1 rounded-md"
                          style={{ background: "#fee2e2", color: "#dc2626" }}
                        >
                          {page.issueCount} issue{page.issueCount > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span
                          className="text-xs font-bold px-2 py-1 rounded-md"
                          style={{ background: "#dcfce7", color: "#16a34a" }}
                        >
                          ✓ Clean
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={16} style={{ color: "#888" }} />
                      ) : (
                        <ChevronDown size={16} style={{ color: "#888" }} />
                      )}
                    </div>
                  </div>
                  {isExpanded && page.issues.length > 0 && (
                    <div
                      className="ml-14 mt-1 mb-2 p-3 rounded-xl"
                      style={{ background: "#FAFAFA", border: "1px solid #f0f0f0" }}
                    >
                      <div className="flex flex-col gap-2">
                        {page.issues.map((issue) => (
                          <div key={issue.key}>
                            <span
                              className="text-xs font-semibold px-2 py-1 rounded-md inline-block"
                              style={{ background: "#fee2e2", color: "#dc2626" }}
                            >
                              {issue.label}
                            </span>
                            {issue.description && (
                              <p
                                className="text-xs leading-relaxed mt-1 ml-1"
                                style={{ color: "#666" }}
                              >
                                {issue.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      {page.topRecommendation && (
                        <p className="text-xs mt-3 leading-relaxed" style={{ color: "#555" }}>
                          <strong>Recommendation:</strong> {page.topRecommendation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {data.pages.length > 10 && (
            <button
              onClick={() => setShowAllPages(!showAllPages)}
              className="w-full mt-4 py-3 rounded-xl text-sm font-bold transition-colors"
              style={{
                background: "#f8f8f8",
                color: "#666",
                border: "1px solid #e4e4e4",
              }}
            >
              {showAllPages
                ? "Show Less"
                : `Show All ${data.pages.length} Pages`}
            </button>
          )}
        </div>

        {/* Highlights / Key Findings */}
        {data.highlights.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2" style={{ color: "#222" }}>
              <CheckCircle2 size={20} style={{ color: "#16a34a" }} />
              Key Findings
            </h2>
            <div className="flex flex-col gap-3">
              {data.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2
                    size={18}
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: "#16a34a" }}
                  />
                  <p className="text-sm" style={{ color: "#444" }}>
                    {h}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Print Button */}
        <div className="text-center mb-6 no-print">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors"
            style={{
              background: "#222",
              color: "#fff",
            }}
          >
            <Printer size={16} />
            Save as PDF
          </button>
        </div>

        {/* Footer */}
        <ReportFooter />
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────

export function ReportHeader({
  clientName,
  subtitle,
}: {
  clientName: string;
  subtitle: string;
}) {
  return (
    <header style={{ background: "#222222" }}>
      <div className="max-w-3xl mx-auto px-6 py-10 text-center">
        <img
          src="/brand/kangomedia_horizontal_reversed.svg"
          alt="KangoMedia"
          className="h-10 w-auto mx-auto mb-6"
        />
        <p
          className="text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {subtitle}
        </p>
        <h1 className="text-3xl font-extrabold text-white">
          {clientName}
        </h1>
      </div>
    </header>
  );
}

/** @deprecated Use ReportHeader instead */
function Header({
  clientName,
  subtitle,
}: {
  clientName: string;
  domain?: string | null;
  subtitle: string;
}) {
  return <ReportHeader clientName={clientName} subtitle={subtitle} />;
}

export function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 text-center"
      style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
    >
      <p
        className="text-xs font-bold uppercase tracking-wide mb-1"
        style={{ color: "#888" }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-extrabold"
        style={{ color: color || "#222" }}
      >
        {value}
      </p>
    </div>
  );
}

export function ReportFooter() {
  return (
    <div className="text-center py-8">
      <img
        src="/brand/logo-default.svg"
        alt="KangoMedia"
        className="h-5 w-auto mx-auto mb-3"
      />
      <p className="text-xs" style={{ color: "#888" }}>
        This report was prepared by{" "}
        <span className="font-bold" style={{ color: "#E34234" }}>
          KangoMedia
        </span>
      </p>
      <p className="text-xs mt-1" style={{ color: "#ccc" }}>
        Questions? Reply to your email or contact us directly.
      </p>
    </div>
  );
}
