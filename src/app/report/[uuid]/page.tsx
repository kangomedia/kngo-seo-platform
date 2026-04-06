"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  FileText,
  Target,
  BarChart3,
  Award,
  MapPin,
  Megaphone,
  Minus,
  Loader2,
} from "lucide-react";

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
}

interface Report {
  id: string;
  uuid: string;
  title: string;
  month: number;
  year: number;
  data: ReportData;
}

export default function PublicReportPage() {
  const params = useParams();
  const uuid = params.uuid as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/reports/${uuid}`)
      .then((r) => {
        if (!r.ok) throw new Error("Report not found");
        return r.json();
      })
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [uuid]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "100vh", background: "#F5F5F5" }}
      >
        <div className="text-center">
          <Loader2
            size={32}
            className="animate-spin mx-auto mb-4"
            style={{ color: "#E34234" }}
          />
          <p className="text-sm" style={{ color: "#888" }}>
            Loading report...
          </p>
        </div>
      </div>
    );
  }

  if (error || !report?.data) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "100vh", background: "#F5F5F5" }}
      >
        <div className="text-center">
          <FileText
            size={48}
            className="mx-auto mb-4"
            style={{ color: "#ccc" }}
          />
          <h2 className="text-xl font-bold mb-2" style={{ color: "#222" }}>
            Report Not Found
          </h2>
          <p className="text-sm" style={{ color: "#888" }}>
            This report may not exist or has not been published yet.
          </p>
        </div>
      </div>
    );
  }

  const d = report.data;
  const stats = d.stats;

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

  return (
    <div style={{ background: "#F5F5F5", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ background: "#222222" }}>
        <div className="max-w-3xl mx-auto px-6 py-8 text-center">
          <img
            src="/brand/logo-white.svg"
            alt="KangoMedia"
            className="h-6 w-auto mx-auto mb-6"
          />
          <p
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Monthly SEO Report
          </p>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            {d.clientName}
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            {d.monthName} {d.year}
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Key Wins */}
        {d.highlights.length > 0 && (
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <p
              className="text-xs font-bold uppercase tracking-wide mb-1"
              style={{ color: "#888" }}
            >
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
            <p
              className="text-xs font-bold uppercase tracking-wide mb-1"
              style={{ color: "#888" }}
            >
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
            <p
              className="text-xs font-bold uppercase tracking-wide mb-1"
              style={{ color: "#888" }}
            >
              Avg Position
            </p>
            <p className="text-2xl font-extrabold" style={{ color: "#222" }}>
              {stats.avgPosition != null ? stats.avgPosition : "—"}
            </p>
          </div>
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <p
              className="text-xs font-bold uppercase tracking-wide mb-1"
              style={{ color: "#888" }}
            >
              Search Volume
            </p>
            <p className="text-2xl font-extrabold" style={{ color: "#222" }}>
              {stats.totalSearchVolume > 0
                ? stats.totalSearchVolume.toLocaleString()
                : "—"}
            </p>
          </div>
        </div>

        {/* Summary */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <h2 className="text-lg font-extrabold mb-3" style={{ color: "#222" }}>
            📋 Summary
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "#555" }}
          >
            {d.summary}
          </p>
        </div>

        {/* Keyword Rankings */}
        {d.keywords.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2
              className="text-lg font-extrabold mb-1"
              style={{ color: "#222" }}
            >
              🎯 Keyword Rankings
            </h2>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              {stats.improvedCount > 0 &&
                `${stats.improvedCount} keyword${stats.improvedCount > 1 ? "s" : ""} improved`}
              {stats.improvedCount > 0 && stats.declinedCount > 0 && " · "}
              {stats.declinedCount > 0 &&
                `${stats.declinedCount} declined`}
              {stats.improvedCount === 0 && stats.declinedCount === 0 &&
                "Current ranking positions"}
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
                        kw.position == null
                          ? "#f1f5f9"
                          : kw.position <= 3
                          ? "#dcfce7"
                          : kw.position <= 10
                          ? "#fef3c7"
                          : "#fee2e2",
                      color:
                        kw.position == null
                          ? "#94a3b8"
                          : kw.position <= 3
                          ? "#16a34a"
                          : kw.position <= 10
                          ? "#b45309"
                          : "#dc2626",
                    }}
                  >
                    {kw.position != null ? `#${kw.position}` : "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-bold truncate"
                      style={{ color: "#222" }}
                    >
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
                      {kw.change > 0 ? (
                        <TrendingUp size={12} />
                      ) : (
                        <TrendingDown size={12} />
                      )}
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
            <h2
              className="text-lg font-extrabold mb-1"
              style={{ color: "#222" }}
            >
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
                  <span className="text-sm">
                    {contentTypeEmoji[item.type] || "📄"}
                  </span>
                  <div className="flex-1">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "#222" }}
                    >
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
                        item.status === "PUBLISHED"
                          ? "#dcfce7"
                          : item.status === "APPROVED"
                          ? "#dbeafe"
                          : "#f1f5f9",
                      color:
                        item.status === "PUBLISHED"
                          ? "#16a34a"
                          : item.status === "APPROVED"
                          ? "#2563eb"
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
            <h2
              className="text-lg font-extrabold mb-4"
              style={{ color: "#222" }}
            >
              📦 Deliverables Progress
            </h2>
            <div className="flex flex-col gap-4">
              {d.deliverables.map((del, i) => {
                const pct =
                  del.targetCount > 0
                    ? Math.min(
                        100,
                        Math.round((del.currentCount / del.targetCount) * 100)
                      )
                    : 0;

                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <p
                        className="text-sm font-bold"
                        style={{ color: "#222" }}
                      >
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
                          background:
                            pct >= 100
                              ? "#16a34a"
                              : pct >= 50
                              ? "#f59e0b"
                              : "#E34234",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8">
          <img
            src="/brand/logo-default.svg"
            alt="KangoMedia"
            className="h-5 w-auto mx-auto mb-3"
          />
          <p className="text-xs" style={{ color: "#888" }}>
            This report was prepared by{" "}
            <a
              href="https://kangomedia.com"
              className="font-bold"
              style={{ color: "#E34234" }}
            >
              KangoMedia
            </a>
          </p>
          <p className="text-xs mt-1" style={{ color: "#ccc" }}>
            Questions? Reply to your monthly email or contact us directly.
          </p>
        </div>
      </div>
    </div>
  );
}
