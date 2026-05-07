"use client";

import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Target,
  Award,
  Minus,
  Printer,
  BarChart3,
  Search,
  DollarSign,
  Phone,
  FileText as FormIcon,
} from "lucide-react";
import { ReportFooter, ReportHeader, StatCard } from "./SiteAuditReport";

interface KeywordEntry {
  keyword: string;
  position: number | null;
  change: number | null;
  searchVolume: number;
  group: string;
}

interface ContentEntry {
  title: string;
  type: string;
  status: string;
  keyword: string | null;
}

interface DeliverableEntry {
  name: string;
  targetCount: number;
  currentCount: number;
  status: string;
}

interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

interface TrafficSource {
  channel: string;
  sessions: number;
  users: number;
}

interface ContentPerfEntry {
  pieceId: string;
  title: string;
  type: string;
  publishedUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  topQueries: { query: string; clicks: number }[];
}

interface PerformanceBlock {
  totalClicks: number;
  totalImpressions: number;
  brandedClicks: number;
  nonBrandedClicks: number;
  estTrafficValueUsd: number;
  cpcUsedUsd: number;
  events: { phoneClicks: number; formSubmits: number; emailClicks: number };
  organicSessions: number;
  contentPerformance: ContentPerfEntry[];
  brandTermsUsed: string[];
}

interface ReportData {
  clientName: string;
  domain: string | null;
  month: number;
  year: number;
  monthName: string;
  stats: {
    totalKeywords: number;
    page1Keywords: number;
    page2Keywords: number;
    avgPosition: number | null;
    totalSearchVolume: number;
    improvedCount: number;
    declinedCount: number;
    publishedContent: number;
    totalContent: number;
    completedDeliverables: number;
    totalDeliverables: number;
  };
  keywords: KeywordEntry[];
  content: ContentEntry[];
  deliverables: DeliverableEntry[];
  highlights: string[];
  summary: string;
  hasGSC?: boolean;
  gsc?: {
    dateRange: { start: string; end: string };
    topQueries: GSCQuery[];
  } | null;
  hasGA4?: boolean;
  ga4?: {
    sessions: number;
    users: number;
    bounceRate: number;
    avgSessionDuration: number;
    pageViews: number;
    trafficSources: TrafficSource[];
  } | null;
  hasPerformance?: boolean;
  performance?: PerformanceBlock | null;
}

const contentTypeEmoji: Record<string, string> = {
  BLOG_POST: "✍️",
  GBP_POST: "📍",
  PRESS_RELEASE: "📢",
};

const contentTypeLabel: Record<string, string> = {
  BLOG_POST: "Blog Post",
  GBP_POST: "Google Business Post",
  PRESS_RELEASE: "Press Release",
};

export default function MonthlyReport({ data }: { data: ReportData }) {
  const d = data;
  const stats = d.stats;

  return (
    <div style={{ background: "#F5F5F5", minHeight: "100vh" }}>
      {/* Header */}
      <ReportHeader
        clientName={d.clientName}
        subtitle={`Monthly SEO Report — ${d.monthName} ${d.year}`}
      />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* ROI Hero — what the campaign returned in dollar terms */}
        {d.hasPerformance && d.performance && (
          <div
            className="rounded-2xl p-6 mb-6 -mt-6 relative z-10"
            style={{
              background: "linear-gradient(135deg, #064e3b, #065f46)",
              border: "1px solid #047857",
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
              color: "#fff",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={18} style={{ color: "#a7f3d0" }} />
              <p
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: "#a7f3d0" }}
              >
                Estimated Traffic Value
              </p>
            </div>
            <p className="text-4xl font-extrabold mb-2">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(d.performance.estTrafficValueUsd)}
            </p>
            <p className="text-sm mb-4" style={{ color: "#a7f3d0" }}>
              {d.performance.nonBrandedClicks.toLocaleString()} non-branded clicks ×{" "}
              ${d.performance.cpcUsedUsd.toFixed(2)} avg CPC — what these visitors would
              have cost in Google Ads.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div
                className="rounded-xl p-3"
                style={{ background: "rgba(0,0,0,0.18)" }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: "#a7f3d0" }}
                >
                  Non-branded clicks
                </p>
                <p className="text-xl font-extrabold mt-1">
                  {d.performance.nonBrandedClicks.toLocaleString()}
                </p>
              </div>
              <div
                className="rounded-xl p-3"
                style={{ background: "rgba(0,0,0,0.18)" }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1"
                  style={{ color: "#a7f3d0" }}
                >
                  <Phone size={10} /> Phone clicks
                </p>
                <p className="text-xl font-extrabold mt-1">
                  {d.performance.events.phoneClicks.toLocaleString()}
                </p>
              </div>
              <div
                className="rounded-xl p-3"
                style={{ background: "rgba(0,0,0,0.18)" }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1"
                  style={{ color: "#a7f3d0" }}
                >
                  <FormIcon size={10} /> Form submits
                </p>
                <p className="text-xl font-extrabold mt-1">
                  {d.performance.events.formSubmits.toLocaleString()}
                </p>
              </div>
              <div
                className="rounded-xl p-3"
                style={{ background: "rgba(0,0,0,0.18)" }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: "#a7f3d0" }}
                >
                  Organic sessions
                </p>
                <p className="text-xl font-extrabold mt-1">
                  {d.performance.organicSessions.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Wins */}
        {d.highlights.length > 0 && (
          <div
            className={`rounded-2xl p-6 mb-6 relative z-10 ${
              d.hasPerformance && d.performance ? "" : "-mt-6"
            }`}
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
              <Award size={20} style={{ color: "#E34234" }} />
              Key Wins This Month
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {d.highlights.map((highlight, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2
                    size={18}
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: "#16a34a" }}
                  />
                  <p className="text-sm" style={{ color: "#444" }}>
                    {highlight}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#888" }}>
              Keywords Tracked
            </p>
            <p className="text-2xl font-extrabold" style={{ color: "#222" }}>
              {stats.totalKeywords}
            </p>
          </div>
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#888" }}>
              On Page 1
            </p>
            <p className="text-2xl font-extrabold" style={{ color: "#16a34a" }}>
              {stats.page1Keywords}
            </p>
          </div>
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#888" }}>
              Avg Position
            </p>
            <p className="text-2xl font-extrabold" style={{ color: "#222" }}>
              {stats.avgPosition != null ? stats.avgPosition : "—"}
            </p>
          </div>
        </div>

        {/* Traffic Overview (GA4) */}
        {d.hasGA4 && d.ga4 && (
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
              <div className="rounded-xl p-4 text-center" style={{ background: "#FAFAFA", border: "1px solid #E4E4E4" }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Sessions</p>
                <p className="text-2xl font-extrabold mb-1" style={{ color: "#222" }}>{d.ga4.sessions.toLocaleString()}</p>
                <p className="text-[10px] leading-tight" style={{ color: "#aaa" }}>Total visits to your website</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: "#FAFAFA", border: "1px solid #E4E4E4" }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Users</p>
                <p className="text-2xl font-extrabold mb-1" style={{ color: "#222" }}>{d.ga4.users.toLocaleString()}</p>
                <p className="text-[10px] leading-tight" style={{ color: "#aaa" }}>Unique visitors this period</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: "#FAFAFA", border: "1px solid #E4E4E4" }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Bounce Rate</p>
                <p className="text-2xl font-extrabold mb-1" style={{ color: d.ga4.bounceRate > 0.7 ? "#dc2626" : "#16a34a" }}>
                  {Math.round(d.ga4.bounceRate * 100)}%
                </p>
                <p className="text-[10px] leading-tight" style={{ color: "#aaa" }}>Left without interacting</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: "#FAFAFA", border: "1px solid #E4E4E4" }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Page Views</p>
                <p className="text-2xl font-extrabold mb-1" style={{ color: "#222" }}>{d.ga4.pageViews.toLocaleString()}</p>
                <p className="text-[10px] leading-tight" style={{ color: "#aaa" }}>Pages explored by visitors</p>
              </div>
            </div>

            {/* Traffic Sources */}
            {d.ga4.trafficSources.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#888" }}>
                  Traffic Sources
                </p>
                <div className="flex flex-col gap-2">
                  {d.ga4.trafficSources.map((src, i) => {
                    const totalSessions = d.ga4!.sessions || 1;
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
                          <div className="rounded-full overflow-hidden" style={{ height: 6, background: "#E4E4E4" }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: "#7C3AED", transition: "width 0.5s ease" }}
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

        {/* Search Visibility (GSC) */}
        {d.hasGSC && d.gsc && (
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
            {(() => {
              const totalClicks = d.gsc.topQueries?.reduce((s, q) => s + q.clicks, 0) || 0;
              const totalImpressions = d.gsc.topQueries?.reduce((s, q) => s + q.impressions, 0) || 0;
              const avgPos = (() => {
                const positions = d.gsc!.topQueries.filter(q => q.position != null).map(q => q.position!);
                if (positions.length === 0) return null;
                return Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10;
              })();
              return (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <StatCard label="Clicks" value={totalClicks.toLocaleString()} color="#16a34a" />
                  <StatCard label="Impressions" value={totalImpressions.toLocaleString()} />
                  <StatCard label="Avg Position" value={avgPos != null ? String(avgPos) : "—"} />
                </div>
              );
            })()}

            {/* Top Queries */}
            {d.gsc.topQueries.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#888" }}>
                  Top Search Queries
                </p>
                <div className="flex flex-col gap-2">
                  {d.gsc.topQueries.slice(0, 10).map((q, i) => (
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

        {/* Branded vs Non-Branded Split */}
        {d.hasPerformance && d.performance && d.performance.totalClicks > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2
              className="text-lg font-extrabold mb-1 flex items-center gap-2"
              style={{ color: "#222" }}
            >
              <Target size={20} style={{ color: "#7C3AED" }} />
              Branded vs Non-Branded Search
            </h2>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              Branded clicks come from people already searching for you. Non-branded clicks
              are <em>new demand</em> the SEO is creating.
            </p>
            {(() => {
              const total = d.performance!.totalClicks;
              const brandedPct = Math.round(
                (d.performance!.brandedClicks / total) * 100
              );
              const nonBrandedPct = 100 - brandedPct;
              return (
                <>
                  <div
                    className="flex rounded-lg overflow-hidden mb-3"
                    style={{ height: 32, background: "#F1F5F9" }}
                  >
                    <div
                      className="flex items-center justify-center text-xs font-extrabold"
                      style={{
                        width: `${nonBrandedPct}%`,
                        background: "#16a34a",
                        color: "#fff",
                      }}
                    >
                      {nonBrandedPct >= 12 && `${nonBrandedPct}% Non-branded`}
                    </div>
                    <div
                      className="flex items-center justify-center text-xs font-extrabold"
                      style={{
                        width: `${brandedPct}%`,
                        background: "#f59e0b",
                        color: "#fff",
                      }}
                    >
                      {brandedPct >= 12 && `${brandedPct}% Branded`}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-xl" style={{ background: "#FAFAFA" }}>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#16a34a" }}>
                        Non-branded · new demand
                      </p>
                      <p className="text-2xl font-extrabold mt-1" style={{ color: "#222" }}>
                        {d.performance!.nonBrandedClicks.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: "#FAFAFA" }}>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#f59e0b" }}>
                        Branded · existing fans
                      </p>
                      <p className="text-2xl font-extrabold mt-1" style={{ color: "#222" }}>
                        {d.performance!.brandedClicks.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Content Performance — per-URL drill-down */}
        {d.hasPerformance &&
          d.performance &&
          d.performance.contentPerformance.length > 0 && (
            <div
              className="rounded-2xl p-6 mb-6"
              style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
            >
              <h2 className="text-lg font-extrabold mb-1" style={{ color: "#222" }}>
                🏆 Which Content Is Working
              </h2>
              <p className="text-sm mb-4" style={{ color: "#888" }}>
                Real Search Console performance for every piece of content we&apos;ve published.
              </p>
              <div className="flex flex-col gap-2">
                {d.performance.contentPerformance.slice(0, 12).map((c) => (
                  <div
                    key={c.pieceId}
                    className="p-3 rounded-xl"
                    style={{ background: "#FAFAFA" }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <a
                          href={c.publishedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold block truncate"
                          style={{ color: "#222", textDecoration: "none" }}
                        >
                          {c.title}
                        </a>
                        <p className="text-xs truncate" style={{ color: "#888" }}>
                          {c.publishedUrl.replace(/^https?:\/\/[^/]+/, "")}
                        </p>
                        {c.topQueries.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {c.topQueries.map((q) => (
                              <span
                                key={q.query}
                                className="text-[10px] px-2 py-0.5 rounded"
                                style={{ background: "#EEF2FF", color: "#4338CA" }}
                              >
                                {q.query} · {q.clicks}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 flex-shrink-0 text-center">
                        <div>
                          <p
                            className="text-base font-extrabold"
                            style={{ color: c.clicks > 0 ? "#16a34a" : "#94a3b8" }}
                          >
                            {c.clicks}
                          </p>
                          <p className="text-[9px] uppercase font-bold" style={{ color: "#888" }}>
                            Clicks
                          </p>
                        </div>
                        <div>
                          <p className="text-base font-extrabold" style={{ color: "#222" }}>
                            {c.impressions.toLocaleString()}
                          </p>
                          <p className="text-[9px] uppercase font-bold" style={{ color: "#888" }}>
                            Imprs
                          </p>
                        </div>
                        <div>
                          <p className="text-base font-extrabold" style={{ color: "#f59e0b" }}>
                            {c.position != null ? c.position.toFixed(1) : "—"}
                          </p>
                          <p className="text-[9px] uppercase font-bold" style={{ color: "#888" }}>
                            Avg Pos
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Summary */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <h2 className="text-lg font-extrabold mb-3" style={{ color: "#222" }}>
            📋 Summary
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "#555" }}>
            {d.summary}
          </p>
        </div>

        {/* Keyword Rankings */}
        {d.keywords.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2 className="text-lg font-extrabold mb-1" style={{ color: "#222" }}>
              🎯 Keyword Rankings
            </h2>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              {stats.improvedCount > 0 &&
                `${stats.improvedCount} keyword${stats.improvedCount > 1 ? "s" : ""} improved`}
              {stats.improvedCount > 0 && stats.declinedCount > 0 && " · "}
              {stats.declinedCount > 0 && `${stats.declinedCount} declined`}
              {stats.improvedCount === 0 && stats.declinedCount === 0 && "Current ranking positions"}
            </p>
            <div className="flex flex-col gap-3">
              {d.keywords.map((kw, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-3 rounded-xl"
                  style={{ background: "#FAFAFA" }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0"
                    style={{
                      background:
                        kw.position == null ? "#f1f5f9"
                        : kw.position <= 3 ? "#dcfce7"
                        : kw.position <= 10 ? "#fef3c7"
                        : "#fee2e2",
                      color:
                        kw.position == null ? "#94a3b8"
                        : kw.position <= 3 ? "#16a34a"
                        : kw.position <= 10 ? "#b45309"
                        : "#dc2626",
                    }}
                  >
                    {kw.position != null ? `#${kw.position}` : "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "#222" }}>
                      {kw.keyword}
                    </p>
                    <p className="text-xs" style={{ color: "#888" }}>
                      {kw.searchVolume > 0
                        ? `${kw.searchVolume.toLocaleString()} monthly searches`
                        : "Volume not available"}
                      {kw.group && kw.group !== "General" && ` · ${kw.group}`}
                    </p>
                  </div>
                  {kw.change != null && kw.change !== 0 && (
                    <div
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                      style={{
                        background: kw.change > 0 ? "#dcfce7" : "#fee2e2",
                        color: kw.change > 0 ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {kw.change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {kw.change > 0 ? "+" : ""}
                      {kw.change}
                    </div>
                  )}
                  {(kw.change == null || kw.change === 0) && (
                    <div
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                      style={{ background: "#f1f5f9", color: "#94a3b8" }}
                    >
                      <Minus size={12} />
                      No change
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Published */}
        {d.content.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2 className="text-lg font-extrabold mb-1" style={{ color: "#222" }}>
              ✍️ Content
            </h2>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              {stats.publishedContent} of {stats.totalContent} pieces published
            </p>
            <div className="flex flex-col gap-2">
              {d.content.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "#FAFAFA" }}
                >
                  <span className="text-sm">{contentTypeEmoji[item.type] || "📄"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "#222" }}>
                      {item.title}
                    </p>
                    <p className="text-xs" style={{ color: "#888" }}>
                      {contentTypeLabel[item.type] || item.type}
                      {item.keyword && ` · ${item.keyword}`}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-1 rounded-md"
                    style={{
                      background:
                        item.status === "PUBLISHED" ? "#dcfce7"
                        : item.status === "APPROVED" ? "#dbeafe"
                        : "#f1f5f9",
                      color:
                        item.status === "PUBLISHED" ? "#16a34a"
                        : item.status === "APPROVED" ? "#2563eb"
                        : "#64748b",
                    }}
                  >
                    {item.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deliverables Progress */}
        {d.deliverables.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2 className="text-lg font-extrabold mb-4" style={{ color: "#222" }}>
              📦 Deliverables Progress
            </h2>
            <div className="flex flex-col gap-4">
              {d.deliverables.map((del, i) => {
                const pct =
                  del.targetCount > 0
                    ? Math.min(100, Math.round((del.currentCount / del.targetCount) * 100))
                    : 0;

                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold" style={{ color: "#222" }}>
                        {del.name}
                      </p>
                      <p className="text-xs font-bold" style={{ color: "#888" }}>
                        {del.currentCount} / {del.targetCount}
                      </p>
                    </div>
                    <div
                      className="rounded-full overflow-hidden"
                      style={{ height: 8, background: "#E4E4E4" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 100 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#E34234",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
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
