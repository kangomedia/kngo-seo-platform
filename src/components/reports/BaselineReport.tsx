"use client";

import {
  Shield,
  Search,
  BarChart3,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertCircle,
  Printer,
  Globe,
  Zap,
} from "lucide-react";
import { StatCard, ReportFooter, ReportHeader } from "./SiteAuditReport";

interface TopIssue {
  key: string;
  label: string;
  count: number;
  severity: string;
}

interface KeywordData {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
  source: string;
}

interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

interface GSCPage {
  page: string;
  clicks: number;
  impressions: number;
}

interface TrafficSource {
  channel: string;
  sessions: number;
  users: number;
}

interface BaselineReportData {
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
  topIssues: TopIssue[];
  highlights: string[];
  hasKeywords: boolean;
  keywords: KeywordData[];
  aiAnalysis: string | null;
  hasGSC: boolean;
  gsc: {
    dateRange: { start: string; end: string };
    topQueries: GSCQuery[];
    topPages: GSCPage[];
  } | null;
  hasGA4: boolean;
  ga4: {
    sessions: number;
    users: number;
    bounceRate: number;
    avgSessionDuration: number;
    pageViews: number;
    trafficSources: TrafficSource[];
  } | null;
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

export default function BaselineReport({ data }: { data: BaselineReportData }) {
  const totalClicks = data.gsc?.topQueries?.reduce((s, q) => s + q.clicks, 0) || 0;
  const totalImpressions = data.gsc?.topQueries?.reduce((s, q) => s + q.impressions, 0) || 0;
  const avgPosition = (() => {
    const queries = data.gsc?.topQueries || [];
    if (queries.length === 0) return null;
    const positions = queries.filter((q) => q.position != null).map((q) => q.position!);
    if (positions.length === 0) return null;
    return Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10;
  })();

  return (
    <div style={{ background: "#F5F5F5", minHeight: "100vh" }}>
      {/* Header */}
      <ReportHeader
        clientName={data.clientName}
        subtitle="SEO Baseline Report"
      />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Key Findings Hero */}
        {data.highlights.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6 -mt-6 relative z-10"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E4E4E4",
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
            }}
          >
            <h2
              className="text-lg font-extrabold mb-4 flex items-center gap-2"
              style={{ color: "#222" }}
            >
              <Zap size={20} style={{ color: "#E34234" }} />
              Your SEO Starting Point
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

        {/* Technical Health Section */}
        {data.hasAuditData && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2
              className="text-lg font-extrabold mb-4 flex items-center gap-2"
              style={{ color: "#222" }}
            >
              <Shield size={20} style={{ color: "#3b82f6" }} />
              Technical Health
            </h2>

            <div className="flex items-center gap-6 mb-6">
              {/* Score circle */}
              {data.healthScore != null && (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: getScoreBg(data.healthScore),
                    border: `3px solid ${getScoreColor(data.healthScore)}`,
                  }}
                >
                  <span
                    className="text-3xl font-extrabold"
                    style={{ color: getScoreColor(data.healthScore) }}
                  >
                    {Math.round(data.healthScore)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-extrabold" style={{ color: "#222" }}>
                      {data.pagesCount}
                    </p>
                    <p className="text-xs" style={{ color: "#888" }}>
                      Pages Crawled
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold" style={{ color: "#dc2626" }}>
                      {data.criticalCount}
                    </p>
                    <p className="text-xs" style={{ color: "#888" }}>
                      Critical Issues
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold" style={{ color: "#f59e0b" }}>
                      {data.warningCount}
                    </p>
                    <p className="text-xs" style={{ color: "#888" }}>
                      Warnings
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top issues condensed */}
            {data.topIssues.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#888" }}>
                  Top Issues to Address
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.topIssues.slice(0, 6).map((issue) => (
                    <span
                      key={issue.key}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{
                        background: issue.severity === "critical" ? "#fee2e2" : "#fef3c7",
                        color: issue.severity === "critical" ? "#dc2626" : "#b45309",
                      }}
                    >
                      {issue.label} ({issue.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search Visibility (GSC) */}
        {data.hasGSC && data.gsc && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2
              className="text-lg font-extrabold mb-1 flex items-center gap-2"
              style={{ color: "#222" }}
            >
              <Search size={20} style={{ color: "#16a34a" }} />
              Search Visibility
            </h2>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              Google Search Console — Last 30 days
            </p>

            {/* GSC Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard label="Clicks" value={totalClicks.toLocaleString()} color="#16a34a" />
              <StatCard label="Impressions" value={totalImpressions.toLocaleString()} />
              <StatCard label="Avg Position" value={avgPosition != null ? String(avgPosition) : "—"} />
            </div>

            {/* Top Queries */}
            {data.gsc.topQueries.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#888" }}>
                  Top Search Queries
                </p>
                <div className="flex flex-col gap-2">
                  {data.gsc.topQueries.slice(0, 10).map((q, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "#FAFAFA" }}
                    >
                      <span
                        className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "#f0f4ff", color: "#3b82f6" }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#222" }}>
                          {q.query}
                        </p>
                        <p className="text-xs" style={{ color: "#888" }}>
                          {q.clicks} clicks · {q.impressions.toLocaleString()} impressions
                          {q.position != null && ` · Pos ${q.position}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Traffic Overview (GA4) */}
        {data.hasGA4 && data.ga4 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2
              className="text-lg font-extrabold mb-1 flex items-center gap-2"
              style={{ color: "#222" }}
            >
              <BarChart3 size={20} style={{ color: "#7C3AED" }} />
              Traffic Overview
            </h2>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              Google Analytics — Last 30 days
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="Sessions" value={data.ga4.sessions.toLocaleString()} />
              <StatCard label="Users" value={data.ga4.users.toLocaleString()} />
              <StatCard
                label="Bounce Rate"
                value={`${Math.round(data.ga4.bounceRate * 100)}%`}
                color={data.ga4.bounceRate > 0.7 ? "#dc2626" : "#16a34a"}
              />
              <StatCard label="Page Views" value={data.ga4.pageViews.toLocaleString()} />
            </div>

            {/* Traffic Sources */}
            {data.ga4.trafficSources.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#888" }}>
                  Traffic Sources
                </p>
                <div className="flex flex-col gap-2">
                  {data.ga4.trafficSources.map((src, i) => {
                    const totalSessions = data.ga4!.sessions || 1;
                    const pct = Math.round((src.sessions / totalSessions) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold" style={{ color: "#222" }}>
                              {src.channel}
                            </p>
                            <p className="text-xs font-bold" style={{ color: "#888" }}>
                              {src.sessions.toLocaleString()} ({pct}%)
                            </p>
                          </div>
                          <div
                            className="rounded-full overflow-hidden"
                            style={{ height: 6, background: "#E4E4E4" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: "#7C3AED",
                                transition: "width 0.5s ease",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Keyword Landscape */}
        {data.hasKeywords && data.keywords.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2
              className="text-lg font-extrabold mb-1 flex items-center gap-2"
              style={{ color: "#222" }}
            >
              <Target size={20} style={{ color: "#f59e0b" }} />
              Keyword Opportunities
            </h2>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              {data.keywords.length} keywords discovered with SEO potential
            </p>

            <div className="flex flex-col gap-2">
              {data.keywords.slice(0, 15).map((kw, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "#FAFAFA" }}
                >
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "#fef3c7", color: "#b45309" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#222" }}>
                      {kw.keyword}
                    </p>
                    <p className="text-xs" style={{ color: "#888" }}>
                      {kw.searchVolume.toLocaleString()} monthly searches ·{" "}
                      {kw.competition}% competition
                      {kw.cpc > 0 && ` · $${kw.cpc.toFixed(2)} CPC`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Strategic Analysis */}
        {data.aiAnalysis && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2
              className="text-lg font-extrabold mb-4 flex items-center gap-2"
              style={{ color: "#222" }}
            >
              <Globe size={20} style={{ color: "#E34234" }} />
              Strategic Analysis
            </h2>
            <div
              className="text-sm leading-relaxed prose prose-sm max-w-none"
              style={{ color: "#444" }}
            >
              {data.aiAnalysis.split("\n").map((line, i) => {
                if (!line.trim()) return <br key={i} />;
                if (line.startsWith("**") && line.endsWith("**")) {
                  return (
                    <h3 key={i} className="text-sm font-bold mt-4 mb-2" style={{ color: "#222" }}>
                      {line.replace(/\*\*/g, "")}
                    </h3>
                  );
                }
                if (line.startsWith("- ") || line.startsWith("* ")) {
                  return (
                    <p key={i} className="ml-4 mb-1" style={{ color: "#444" }}>
                      • {line.slice(2)}
                    </p>
                  );
                }
                if (line.match(/^\d+\.\s/)) {
                  return (
                    <p key={i} className="ml-4 mb-1" style={{ color: "#444" }}>
                      {line}
                    </p>
                  );
                }
                return (
                  <p key={i} className="mb-2" style={{ color: "#444" }}>
                    {line}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {/* No Google Data Notice */}
        {!data.hasGSC && !data.hasGA4 && (
          <div
            className="rounded-2xl p-6 mb-6 text-center"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <AlertCircle size={32} className="mx-auto mb-3" style={{ color: "#f59e0b" }} />
            <h3 className="text-sm font-bold mb-1" style={{ color: "#222" }}>
              Google Analytics & Search Console Not Connected
            </h3>
            <p className="text-xs" style={{ color: "#888" }}>
              Connect Google integrations to see traffic, search visibility, and click data
              in future reports.
            </p>
          </div>
        )}

        {/* Print Button */}
        <div className="text-center mb-6 no-print">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors"
            style={{ background: "#222", color: "#fff" }}
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
