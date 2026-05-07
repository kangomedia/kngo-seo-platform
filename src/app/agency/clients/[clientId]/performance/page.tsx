"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  DollarSign,
  Phone,
  FileText,
  Mail,
  TrendingUp,
  Search,
  ExternalLink,
  Tag,
  Globe,
} from "lucide-react";

interface ContentRow {
  pieceId: string;
  title: string;
  type: string;
  publishedUrl: string;
  publishedAt: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  topQueries: { query: string; clicks: number }[];
}

interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  isBranded: boolean;
}

interface Summary {
  dateRange: { start: string; end: string };
  hasGSC: boolean;
  hasGA4: boolean;
  totalClicks: number;
  totalImpressions: number;
  brandedClicks: number;
  nonBrandedClicks: number;
  estTrafficValueUsd: number;
  cpcUsedUsd: number;
  events: { phoneClicks: number; formSubmits: number; emailClicks: number };
  organicSessions: number;
  totalSessions: number;
  topQueries: QueryRow[];
  contentPerformance: ContentRow[];
  brandTermsUsed: string[];
  error?: string;
}

function MetricCard({
  label,
  value,
  sub,
  color = "#e5e7eb",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#1f2937",
        borderRadius: 12,
        border: "1px solid #374151",
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {icon}
        <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function PerformancePage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/performance?days=${days}`);
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [clientId, days]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        Loading performance…
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        {data?.error || "Could not load performance data."}
      </div>
    );
  }

  if (!data.hasGSC && !data.hasGA4) {
    return (
      <div
        style={{
          background: "#1f2937",
          borderRadius: 12,
          padding: 60,
          textAlign: "center",
          border: "1px solid #374151",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
        <h3 style={{ color: "#e5e7eb", margin: "0 0 8px" }}>Connect Google to see performance</h3>
        <p style={{ color: "#9ca3af", fontSize: 14, maxWidth: 500, margin: "0 auto" }}>
          Performance metrics need Search Console (for clicks) and Analytics (for engagement events).
          Open the Analytics tab to connect.
        </p>
      </div>
    );
  }

  const valueFmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const brandedPct =
    data.totalClicks > 0
      ? Math.round((data.brandedClicks / data.totalClicks) * 100)
      : 0;
  const nonBrandedPct = 100 - brandedPct;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>
            💰 Performance & ROI
          </h1>
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>
            What the SEO campaign actually returned — {data.dateRange.start} to {data.dateRange.end}
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          style={{
            background: "#1f2937",
            color: "#e5e7eb",
            border: "1px solid #374151",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
          }}
        >
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 6 months</option>
        </select>
      </div>

      {/* Hero: Traffic Value */}
      <div
        style={{
          marginTop: 20,
          marginBottom: 20,
          padding: 28,
          borderRadius: 16,
          background: "linear-gradient(135deg, #064e3b, #065f46)",
          border: "1px solid #047857",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <DollarSign size={18} style={{ color: "#6ee7b7" }} />
          <div style={{ fontSize: 12, color: "#a7f3d0", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Estimated Traffic Value
          </div>
        </div>
        <div style={{ fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1, marginBottom: 8 }}>
          {valueFmt.format(data.estTrafficValueUsd)}
        </div>
        <div style={{ fontSize: 13, color: "#a7f3d0" }}>
          {data.nonBrandedClicks.toLocaleString()} non-branded clicks × ${data.cpcUsedUsd.toFixed(2)} avg CPC
          — what these visitors would cost in Google Ads.
        </div>
      </div>

      {/* Engagement signals */}
      <h2 style={{ color: "#e5e7eb", fontSize: 16, fontWeight: 700, marginTop: 28, marginBottom: 12 }}>
        High-Intent Actions
      </h2>
      <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 0, marginBottom: 14 }}>
        Visitors who took an action on the site. Requires GTM events (<code>phone_click</code>,{" "}
        <code>form_submit</code>, <code>email_click</code>) firing to GA4.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <MetricCard
          label="Phone Clicks"
          value={data.events.phoneClicks.toLocaleString()}
          sub="People who tapped the phone number"
          color="#22c55e"
          icon={<Phone size={14} style={{ color: "#22c55e" }} />}
        />
        <MetricCard
          label="Form Submits"
          value={data.events.formSubmits.toLocaleString()}
          sub="Contact form completions"
          color="#3b82f6"
          icon={<FileText size={14} style={{ color: "#3b82f6" }} />}
        />
        <MetricCard
          label="Email Clicks"
          value={data.events.emailClicks.toLocaleString()}
          sub="Mailto link clicks"
          color="#a78bfa"
          icon={<Mail size={14} style={{ color: "#a78bfa" }} />}
        />
      </div>

      {/* Search demand */}
      <h2 style={{ color: "#e5e7eb", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        Search Demand
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
        <MetricCard
          label="Total Clicks"
          value={data.totalClicks.toLocaleString()}
          color="#22c55e"
          icon={<Search size={14} style={{ color: "#22c55e" }} />}
        />
        <MetricCard
          label="Impressions"
          value={data.totalImpressions.toLocaleString()}
          color="#e5e7eb"
        />
        <MetricCard
          label="Branded Clicks"
          value={`${data.brandedClicks.toLocaleString()} (${brandedPct}%)`}
          sub="People who already know the brand"
          color="#f59e0b"
        />
        <MetricCard
          label="Non-Branded Clicks"
          value={`${data.nonBrandedClicks.toLocaleString()} (${nonBrandedPct}%)`}
          sub="New demand the SEO created"
          color="#22c55e"
          icon={<TrendingUp size={14} style={{ color: "#22c55e" }} />}
        />
      </div>

      {/* Branded split bar */}
      <div
        style={{
          background: "#1f2937",
          borderRadius: 12,
          border: "1px solid #374151",
          padding: 18,
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Tag size={14} style={{ color: "#9ca3af" }} />
          <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>
            Brand terms used: {data.brandTermsUsed.join(", ") || "(none derived)"}
          </div>
        </div>
        <div style={{ display: "flex", height: 24, borderRadius: 6, overflow: "hidden", background: "#111827" }}>
          <div
            style={{
              width: `${nonBrandedPct}%`,
              background: "#22c55e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0b3d20",
              fontWeight: 700,
              fontSize: 12,
            }}
            title={`Non-branded: ${data.nonBrandedClicks} clicks`}
          >
            {nonBrandedPct >= 12 && `${nonBrandedPct}% non-branded`}
          </div>
          <div
            style={{
              width: `${brandedPct}%`,
              background: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#3d2a00",
              fontWeight: 700,
              fontSize: 12,
            }}
            title={`Branded: ${data.brandedClicks} clicks`}
          >
            {brandedPct >= 12 && `${brandedPct}% branded`}
          </div>
        </div>
      </div>

      {/* Content performance */}
      <h2 style={{ color: "#e5e7eb", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
        Content Performance
      </h2>
      <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 0, marginBottom: 14 }}>
        Each piece of published content joined to its actual Search Console data over the period.
      </p>

      {data.contentPerformance.length === 0 ? (
        <div
          style={{
            background: "#1f2937",
            borderRadius: 12,
            border: "1px dashed #374151",
            padding: 40,
            textAlign: "center",
            color: "#9ca3af",
            fontSize: 14,
            marginBottom: 24,
          }}
        >
          <Globe size={20} style={{ marginBottom: 8, opacity: 0.6 }} />
          <div>No published content with URLs yet — publish a piece via WordPress to start tracking performance.</div>
        </div>
      ) : (
        <div
          style={{
            background: "#1f2937",
            borderRadius: 12,
            border: "1px solid #374151",
            overflow: "hidden",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px 90px 60px 60px",
              gap: 8,
              padding: "10px 18px",
              borderBottom: "1px solid #374151",
              color: "#6b7280",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            <span>Content</span>
            <span style={{ textAlign: "right" }}>Clicks</span>
            <span style={{ textAlign: "right" }}>Imprs</span>
            <span style={{ textAlign: "right" }}>CTR</span>
            <span style={{ textAlign: "right" }}>Pos</span>
          </div>
          {data.contentPerformance.map((c) => (
            <div
              key={c.pieceId}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 70px 90px 60px 60px",
                gap: 8,
                padding: "12px 18px",
                borderBottom: "1px solid #1a2332",
                fontSize: 13,
                alignItems: "start",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <a
                  href={c.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#e5e7eb",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 460,
                      display: "inline-block",
                    }}
                  >
                    {c.title}
                  </span>
                  <ExternalLink size={11} style={{ color: "#6b7280" }} />
                </a>
                <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                  {c.publishedUrl.replace(/^https?:\/\/[^/]+/, "")}
                </div>
                {c.topQueries.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {c.topQueries.map((q) => (
                      <span
                        key={q.query}
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#0f1a2c",
                          color: "#9ca3af",
                          border: "1px solid #1f2937",
                        }}
                      >
                        {q.query} · {q.clicks}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span style={{ textAlign: "right", color: c.clicks > 0 ? "#22c55e" : "#6b7280", fontWeight: 700 }}>
                {c.clicks}
              </span>
              <span style={{ textAlign: "right", color: "#9ca3af" }}>
                {c.impressions.toLocaleString()}
              </span>
              <span style={{ textAlign: "right", color: "#9ca3af" }}>
                {(c.ctr * 100).toFixed(1)}%
              </span>
              <span style={{ textAlign: "right", color: "#f59e0b", fontWeight: 600 }}>
                {c.position != null ? c.position.toFixed(1) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Top non-branded queries */}
      <h2 style={{ color: "#e5e7eb", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        Top Non-Branded Queries
      </h2>
      <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 0, marginBottom: 14 }}>
        New demand the SEO is capturing — queries from people who don&apos;t already know the brand.
      </p>
      <div
        style={{
          background: "#1f2937",
          borderRadius: 12,
          border: "1px solid #374151",
          overflow: "hidden",
          marginBottom: 32,
        }}
      >
        {data.topQueries
          .filter((q) => !q.isBranded)
          .slice(0, 15)
          .map((q) => (
            <div
              key={q.query}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 60px 80px 60px",
                gap: 8,
                padding: "10px 18px",
                borderBottom: "1px solid #1a2332",
                fontSize: 13,
              }}
            >
              <span
                style={{
                  color: "#d1d5db",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {q.query}
              </span>
              <span style={{ textAlign: "right", color: "#22c55e", fontWeight: 600 }}>
                {q.clicks}
              </span>
              <span style={{ textAlign: "right", color: "#9ca3af" }}>
                {q.impressions.toLocaleString()}
              </span>
              <span style={{ textAlign: "right", color: "#f59e0b" }}>
                {q.position != null ? q.position.toFixed(1) : "—"}
              </span>
            </div>
          ))}
        {data.topQueries.filter((q) => !q.isBranded).length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
            No non-branded queries yet for this period.
          </div>
        )}
      </div>
    </div>
  );
}
