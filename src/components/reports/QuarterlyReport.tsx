"use client";

import {
  DollarSign,
  Phone,
  FileText,
  TrendingUp,
  Award,
  Printer,
  CheckCircle2,
} from "lucide-react";
import { ReportFooter, ReportHeader } from "./SiteAuditReport";

interface SeriesPoint {
  month: number;
  clicks: number;
  nonBrandedClicks: number;
  estTrafficValue: number;
  phoneClicks: number;
  formSubmits: number;
}

interface TopContentPiece {
  url: string;
  title: string;
  clicks: number;
  impressions: number;
}

interface QuarterlyData {
  clientName: string;
  reportType: "QUARTERLY";
  quarter: number;
  year: number;
  quarterLabel: string;
  generatedAt: string;
  totals: {
    clicks: number;
    impressions: number;
    nonBrandedClicks: number;
    brandedClicks: number;
    estTrafficValue: number;
    phoneClicks: number;
    formSubmits: number;
    organicSessions: number;
  };
  priorTotals: {
    clicks: number;
    estTrafficValue: number;
    phoneClicks: number;
    formSubmits: number;
  };
  series: SeriesPoint[];
  topContent: TopContentPiece[];
  narrative: string;
  highlights: string[];
}

const monthShort = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function delta(current: number, prior: number): { pct: number; positive: boolean } {
  if (prior === 0) return { pct: 0, positive: current > 0 };
  const pct = Math.round(((current - prior) / prior) * 100);
  return { pct, positive: pct >= 0 };
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function QuarterlyReport({ data }: { data: QuarterlyData }) {
  const d = data;
  const valueDelta = delta(d.totals.estTrafficValue, d.priorTotals.estTrafficValue);
  const clicksDelta = delta(d.totals.clicks, d.priorTotals.clicks);
  const phoneDelta = delta(d.totals.phoneClicks, d.priorTotals.phoneClicks);
  const formDelta = delta(d.totals.formSubmits, d.priorTotals.formSubmits);

  const maxValue = Math.max(...d.series.map((s) => s.estTrafficValue), 1);

  return (
    <div style={{ background: "#F5F5F5", minHeight: "100vh" }}>
      <ReportHeader
        clientName={d.clientName}
        subtitle={`Quarterly SEO Story — ${d.quarterLabel}`}
      />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Hero ROI */}
        <div
          className="rounded-2xl p-7 mb-6 -mt-6 relative z-10"
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
              {d.quarterLabel} estimated traffic value
            </p>
          </div>
          <p className="text-5xl font-extrabold mb-2">
            {formatCurrency(d.totals.estTrafficValue)}
          </p>
          <p className="text-sm" style={{ color: "#a7f3d0" }}>
            Total search traffic value across the quarter.{" "}
            {valueDelta.pct !== 0 && (
              <span style={{ color: valueDelta.positive ? "#bbf7d0" : "#fecaca" }}>
                {valueDelta.positive ? "+" : ""}
                {valueDelta.pct}% vs the prior quarter.
              </span>
            )}
          </p>
        </div>

        {/* AI narrative */}
        {d.narrative && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E4E4E4",
            }}
          >
            <h2 className="text-lg font-extrabold mb-3" style={{ color: "#222" }}>
              The Quarter in a Nutshell
            </h2>
            <div
              className="text-sm leading-relaxed whitespace-pre-line"
              style={{ color: "#444" }}
            >
              {d.narrative}
            </div>
          </div>
        )}

        {/* Highlights */}
        {d.highlights.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2
              className="text-lg font-extrabold mb-4 flex items-center gap-2"
              style={{ color: "#222" }}
            >
              <Award size={20} style={{ color: "#E34234" }} />
              Quarterly Highlights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {d.highlights.map((h, i) => (
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

        {/* Quarter-vs-Quarter cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: "Organic Clicks",
              value: d.totals.clicks.toLocaleString(),
              delta: clicksDelta,
              icon: <TrendingUp size={14} style={{ color: "#22c55e" }} />,
            },
            {
              label: "Phone Clicks",
              value: d.totals.phoneClicks.toLocaleString(),
              delta: phoneDelta,
              icon: <Phone size={14} style={{ color: "#22c55e" }} />,
            },
            {
              label: "Form Submits",
              value: d.totals.formSubmits.toLocaleString(),
              delta: formDelta,
              icon: <FileText size={14} style={{ color: "#3b82f6" }} />,
            },
            {
              label: "Non-Branded Clicks",
              value: d.totals.nonBrandedClicks.toLocaleString(),
              delta: { pct: 0, positive: true },
              icon: null,
            },
          ].map((c, i) => (
            <div
              key={i}
              className="rounded-2xl p-4"
              style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
            >
              <div className="flex items-center gap-2 mb-1">
                {c.icon}
                <p
                  className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: "#888" }}
                >
                  {c.label}
                </p>
              </div>
              <p className="text-2xl font-extrabold" style={{ color: "#222" }}>
                {c.value}
              </p>
              {c.delta.pct !== 0 && (
                <p
                  className="text-xs font-bold mt-1"
                  style={{ color: c.delta.positive ? "#16a34a" : "#dc2626" }}
                >
                  {c.delta.positive ? "+" : ""}
                  {c.delta.pct}% vs prior quarter
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Monthly trend bar chart (traffic value) */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <h2 className="text-lg font-extrabold mb-1" style={{ color: "#222" }}>
            Traffic Value by Month
          </h2>
          <p className="text-sm mb-5" style={{ color: "#888" }}>
            How the campaign compounded month over month.
          </p>
          <div className="flex items-end gap-4 h-48">
            {d.series.map((s) => {
              const heightPct = Math.max(
                4,
                Math.round((s.estTrafficValue / maxValue) * 100)
              );
              return (
                <div
                  key={s.month}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <p className="text-xs font-bold" style={{ color: "#222" }}>
                    {formatCurrency(s.estTrafficValue)}
                  </p>
                  <div
                    className="w-full rounded-t-xl"
                    style={{
                      height: `${heightPct}%`,
                      background:
                        "linear-gradient(180deg, #16a34a, #047857)",
                      minHeight: 8,
                    }}
                  />
                  <p
                    className="text-xs font-bold uppercase"
                    style={{ color: "#888" }}
                  >
                    {monthShort[s.month]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top performing content */}
        {d.topContent.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <h2 className="text-lg font-extrabold mb-1" style={{ color: "#222" }}>
              🏆 Top 5 Pages This Quarter
            </h2>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              The pages that brought in the most search traffic across the three months.
            </p>
            <div className="flex flex-col gap-2">
              {d.topContent.map((c, i) => (
                <div
                  key={c.url}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "#FAFAFA" }}
                >
                  <span
                    className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-extrabold flex-shrink-0"
                    style={{ background: "#dcfce7", color: "#16a34a" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold block truncate"
                      style={{ color: "#222", textDecoration: "none" }}
                    >
                      {c.title}
                    </a>
                    <p className="text-xs truncate" style={{ color: "#888" }}>
                      {c.url.replace(/^https?:\/\/[^/]+/, "")}
                    </p>
                  </div>
                  <div className="flex gap-3 flex-shrink-0 text-center">
                    <div>
                      <p className="text-base font-extrabold" style={{ color: "#16a34a" }}>
                        {c.clicks}
                      </p>
                      <p
                        className="text-[9px] uppercase font-bold"
                        style={{ color: "#888" }}
                      >
                        Clicks
                      </p>
                    </div>
                    <div>
                      <p className="text-base font-extrabold" style={{ color: "#222" }}>
                        {c.impressions.toLocaleString()}
                      </p>
                      <p
                        className="text-[9px] uppercase font-bold"
                        style={{ color: "#888" }}
                      >
                        Imprs
                      </p>
                    </div>
                  </div>
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
            style={{ background: "#222", color: "#fff" }}
          >
            <Printer size={16} />
            Save as PDF
          </button>
        </div>

        <ReportFooter />
      </div>
    </div>
  );
}
