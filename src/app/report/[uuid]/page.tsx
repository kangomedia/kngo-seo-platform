"use client";

import {
  TrendingUp,
  CheckCircle2,
  FileText,
  Target,
  BarChart3,
  Award,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

// Mock report data
const reportData = {
  clientName: "Mission AC & Heating",
  month: "March",
  year: 2026,
  highlights: [
    "4 new keywords reached page 1 of Google",
    "Average position improved by 3.1 positions",
    "Published 6 new content pieces",
    "Website traffic increased 18% month-over-month",
  ],
  summary:
    "March was a great month for your SEO! We focused on creating high-quality blog content around your core AC repair and HVAC services keywords. The content strategy is paying off — your visibility on Google continues to climb, and more potential customers are finding your website through organic search.",
  rankingData: [
    { keyword: "ac repair denver", position: 4, change: 4, volume: 2400 },
    { keyword: "furnace repair denver", position: 3, change: 2, volume: 1900 },
    { keyword: "hvac company near me", position: 7, change: 5, volume: 4800 },
    { keyword: "heating installation denver", position: 6, change: 3, volume: 880 },
    { keyword: "emergency ac repair", position: 11, change: 4, volume: 1200 },
  ],
  contentPublished: [
    { title: "5 Signs Your AC Needs Repair Before Summer", type: "Blog Post" },
    { title: "Spring AC Tune-Up Special — $89", type: "GBP Post" },
    { title: "Why Denver Homeowners Trust Mission AC", type: "GBP Post" },
    { title: "Emergency AC Repair — Same Day Service", type: "GBP Post" },
  ],
  trendData: Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    page1: Math.round(8 + (i / 30) * 4 + Math.sin(i * 0.3) * 1.5),
    traffic: Math.round(120 + (i / 30) * 40 + Math.random() * 20),
  })),
};

export default function PublicReportPage() {
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
            {reportData.clientName}
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            {reportData.month} {reportData.year}
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Highlights */}
        <div
          className="rounded-2xl p-6 mb-6 -mt-6 relative z-10"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E4E4E4",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}
        >
          <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2" style={{ color: "#222" }}>
            <Award size={20} style={{ color: "#E34234" }} />
            Key Wins This Month
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reportData.highlights.map((highlight, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
                <p className="text-sm" style={{ color: "#444" }}>{highlight}</p>
              </div>
            ))}
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
          <p className="text-sm leading-relaxed" style={{ color: "#555" }}>
            {reportData.summary}
          </p>
        </div>

        {/* Visibility Chart */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <h2 className="text-lg font-extrabold mb-1" style={{ color: "#222" }}>
            📈 Your Google Visibility
          </h2>
          <p className="text-sm mb-4" style={{ color: "#888" }}>
            Keywords appearing on Google page 1 over the past 30 days
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={reportData.trendData}>
              <defs>
                <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E34234" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#E34234" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #E4E4E4",
                  borderRadius: 12,
                  fontSize: 12,
                  fontFamily: "Montserrat",
                }}
              />
              <Area
                type="monotone"
                dataKey="page1"
                stroke="#E34234"
                strokeWidth={2.5}
                fill="url(#reportGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Rankings */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <h2 className="text-lg font-extrabold mb-4" style={{ color: "#222" }}>
            🎯 Top Keyword Rankings
          </h2>
          <div className="flex flex-col gap-3">
            {reportData.rankingData.map((kw, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 rounded-xl"
                style={{ background: "#FAFAFA" }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0"
                  style={{
                    background: kw.position <= 3 ? "#dcfce7" : kw.position <= 10 ? "#fef3c7" : "#fee2e2",
                    color: kw.position <= 3 ? "#16a34a" : kw.position <= 10 ? "#b45309" : "#dc2626",
                  }}
                >
                  #{kw.position}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "#222" }}>
                    {kw.keyword}
                  </p>
                  <p className="text-xs" style={{ color: "#888" }}>
                    {kw.volume.toLocaleString()} monthly searches
                  </p>
                </div>
                <div
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                  style={{ background: "#dcfce7", color: "#16a34a" }}
                >
                  <TrendingUp size={12} />
                  +{kw.change}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Published */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <h2 className="text-lg font-extrabold mb-4" style={{ color: "#222" }}>
            ✍️ Content Published
          </h2>
          <div className="flex flex-col gap-2">
            {reportData.contentPublished.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#FAFAFA" }}>
                <span className="text-sm">
                  {item.type === "Blog Post" ? "✍️" : item.type === "GBP Post" ? "📍" : "📢"}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "#222" }}>{item.title}</p>
                  <p className="text-xs" style={{ color: "#888" }}>{item.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8">
          <img
            src="/brand/logo-default.svg"
            alt="KangoMedia"
            className="h-5 w-auto mx-auto mb-3"
          />
          <p className="text-xs" style={{ color: "#888" }}>
            This report was prepared by{" "}
            <a href="https://kangomedia.com" className="font-bold" style={{ color: "#E34234" }}>
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
