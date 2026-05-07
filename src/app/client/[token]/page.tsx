"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getClientByToken,
  getClientRankHistory,
  getClientPerformance,
} from "@/lib/actions-public";
import {
  TrendingUp,
  CheckCircle2,
  FileText,
  Star,
  ArrowRight,
  Phone,
  DollarSign,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import Link from "next/link";

function InsightCard({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div
      className="p-5 rounded-2xl"
      style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
    >
      <div className="text-2xl mb-3">{emoji}</div>
      <h3 className="text-sm font-bold mb-1" style={{ color: "#222" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
        {description}
      </p>
    </div>
  );
}

interface ClientData {
  name: string;
  keywords: Array<{
    id: string;
    keyword: string;
    snapshots: Array<{ position: number | null; checkedAt: Date }>;
  }>;
  _count: {
    keywords: number;
    contentPlans: number;
    deliverables: number;
    reports: number;
  };
}

interface PerformanceData {
  hasGSC: boolean;
  estTrafficValueUsd: number;
  cpcUsedUsd: number;
  nonBrandedClicks: number;
  organicSessions: number;
  events: { phoneClicks: number; formSubmits: number; emailClicks: number };
  contentPerformance: Array<{
    pieceId: string;
    title: string;
    publishedUrl: string;
    clicks: number;
    impressions: number;
    position: number | null;
  }>;
}

export default function ClientDashboard() {
  const params = useParams();
  const token = params.token as string;
  const [client, setClient] = useState<ClientData | null>(null);
  const [trendData, setTrendData] = useState<Array<{ date: string; page1Count: number }>>([]);
  const [perf, setPerf] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getClientByToken(token);
      if (data) {
        setClient(data as unknown as ClientData);

        // Performance summary (separate fetch — slow if Google APIs are slow,
        // so load it in parallel with the rank history)
        getClientPerformance(token, 30).then((p) => {
          if (p) setPerf(p as unknown as PerformanceData);
        });

        // Build trend data from rank history
        const history = await getClientRankHistory(token, 30);
        if (history && history.length > 0) {
          // Group snapshots by date
          const grouped: Record<string, Set<string>> = {};
          history.forEach((snap: { checkedAt: Date; position: number | null; keywordId: string }) => {
            const date = new Date(snap.checkedAt).toISOString().split("T")[0];
            if (!grouped[date]) grouped[date] = new Set();
            if (snap.position && snap.position <= 10) {
              grouped[date].add(snap.keywordId);
            }
          });
          const trend = Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, kwSet]) => ({ date, page1Count: kwSet.size }));
          setTrendData(trend);
        }
      }
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "#E34234", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "#888" }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!client) return null;

  // Calculate metrics from real data
  const page1Keywords = client.keywords.filter(
    (kw) => kw.snapshots[0]?.position && kw.snapshots[0].position <= 10
  ).length;

  const prevPage1 = client.keywords.filter(
    (kw) => kw.snapshots[1]?.position && kw.snapshots[1].position <= 10
  ).length;

  const page1Change = page1Keywords - prevPage1;
  const healthScore = client._count.keywords > 0
    ? Math.round((page1Keywords / client._count.keywords) * 100)
    : 0;

  return (
    <div>
      {/* Welcome Banner */}
      <div
        className="rounded-2xl p-8 mb-8 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #222222, #444444)",
          color: "#fff",
        }}
      >
        <div className="relative z-10">
          <p className="text-sm font-semibold mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>
            Welcome back 👋
          </p>
          <h1 className="text-3xl font-extrabold mb-2">{client.name}</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
            Here&apos;s how your SEO is performing this month
          </p>
        </div>
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full"
          style={{
            background: "rgba(227, 66, 52, 0.15)",
            filter: "blur(60px)",
            transform: "translate(30%, -30%)",
          }}
        />
      </div>

      {/* Results Hero — last 30 days, plain-English */}
      {perf && perf.hasGSC && (
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            background: "linear-gradient(135deg, #064e3b, #065f46)",
            border: "1px solid #047857",
            color: "#fff",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={18} style={{ color: "#a7f3d0" }} />
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#a7f3d0" }}>
              Estimated Value of Your Search Traffic — Last 30 Days
            </p>
          </div>
          <p className="text-4xl font-extrabold mb-2">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(perf.estTrafficValueUsd)}
          </p>
          <p className="text-sm" style={{ color: "#a7f3d0" }}>
            That&apos;s what you&apos;d have paid Google Ads to bring in the same visitors. SEO is the
            asset doing it for you.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <div className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.18)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#a7f3d0" }}>
                New visitors from search
              </p>
              <p className="text-xl font-extrabold mt-1">{perf.nonBrandedClicks.toLocaleString()}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.18)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1" style={{ color: "#a7f3d0" }}>
                <Phone size={10} /> Phone clicks
              </p>
              <p className="text-xl font-extrabold mt-1">{perf.events.phoneClicks.toLocaleString()}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.18)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#a7f3d0" }}>
                Form submissions
              </p>
              <p className="text-xl font-extrabold mt-1">{perf.events.formSubmits.toLocaleString()}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.18)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#a7f3d0" }}>
                Organic sessions
              </p>
              <p className="text-xl font-extrabold mt-1">{perf.organicSessions.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Simple Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div
          className="p-5 rounded-2xl text-center"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <div
            className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: "#dcfce7", color: "#16a34a" }}
          >
            <TrendingUp size={22} />
          </div>
          <p className="text-3xl font-extrabold mb-1" style={{ color: "#222" }}>
            {page1Keywords}
          </p>
          <p className="text-sm font-semibold" style={{ color: "#888" }}>
            keywords on page 1
          </p>
          {page1Change !== 0 && (
            <p className="text-xs mt-1 font-bold" style={{ color: page1Change > 0 ? "#16a34a" : "#dc2626" }}>
              {page1Change > 0 ? `+${page1Change} more than last check!` : `${page1Change} since last check`}
            </p>
          )}
        </div>

        <div
          className="p-5 rounded-2xl text-center"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <div
            className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: "#fff0ef", color: "#E34234" }}
          >
            <FileText size={22} />
          </div>
          <p className="text-3xl font-extrabold mb-1" style={{ color: "#222" }}>
            {client._count.contentPlans}
          </p>
          <p className="text-sm font-semibold" style={{ color: "#888" }}>
            content plans
          </p>
          <p className="text-xs mt-1" style={{ color: "#888" }}>
            blogs, GBP posts & press releases
          </p>
        </div>

        <div
          className="p-5 rounded-2xl text-center"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <div
            className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: "#eff6ff", color: "#1d4ed8" }}
          >
            <Star size={22} />
          </div>
          <p className="text-3xl font-extrabold mb-1" style={{ color: "#222" }}>
            {healthScore}%
          </p>
          <p className="text-sm font-semibold" style={{ color: "#888" }}>
            SEO health score
          </p>
          <p className="text-xs mt-1" style={{ color: "#888" }}>
            {healthScore >= 80 ? "Looking great!" : healthScore >= 60 ? "Improving steadily" : "We're working on it"}
          </p>
        </div>
      </div>

      {/* Visibility Trend */}
      {trendData.length > 0 && (
        <div
          className="rounded-2xl p-6 mb-8"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <h2 className="text-lg font-extrabold mb-1" style={{ color: "#222" }}>
            Your Visibility is Growing 📈
          </h2>
          <p className="text-sm mb-4" style={{ color: "#888" }}>
            This shows how many of your keywords are on Google&apos;s page 1 over the past 30 days
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="clientTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E34234" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#E34234" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#888" }}
                tickFormatter={(d) => {
                  const date = new Date(d);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #E4E4E4",
                  borderRadius: 12,
                  fontSize: 12,
                  fontFamily: "Montserrat",
                }}
                labelFormatter={(d) => `Date: ${d}`}
              />
              <Area
                type="monotone"
                dataKey="page1Count"
                stroke="#E34234"
                strokeWidth={2.5}
                fill="url(#clientTrend)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Content Performance — which articles drove traffic */}
      {perf && perf.contentPerformance.length > 0 && (
        <div
          className="rounded-2xl p-6 mb-8"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
        >
          <h2 className="text-lg font-extrabold mb-1" style={{ color: "#222" }}>
            Which Content Worked 🏆
          </h2>
          <p className="text-sm mb-4" style={{ color: "#888" }}>
            Real Search Console data for each piece of content we&apos;ve published — last 30 days
          </p>
          <div className="flex flex-col gap-2">
            {perf.contentPerformance.slice(0, 8).map((c) => (
              <div
                key={c.pieceId}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "#FAFAFA" }}
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={c.publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold truncate block"
                    style={{ color: "#222", textDecoration: "none" }}
                  >
                    {c.title}
                  </a>
                  <p className="text-xs truncate" style={{ color: "#888" }}>
                    {c.publishedUrl.replace(/^https?:\/\/[^/]+/, "")}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-base font-extrabold" style={{ color: c.clicks > 0 ? "#16a34a" : "#94a3b8" }}>
                      {c.clicks}
                    </p>
                    <p className="text-[10px] uppercase font-bold" style={{ color: "#888" }}>
                      Clicks
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-extrabold" style={{ color: "#222" }}>
                      {c.impressions.toLocaleString()}
                    </p>
                    <p className="text-[10px] uppercase font-bold" style={{ color: "#888" }}>
                      Imprs
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-extrabold" style={{ color: "#f59e0b" }}>
                      {c.position != null ? c.position.toFixed(1) : "—"}
                    </p>
                    <p className="text-[10px] uppercase font-bold" style={{ color: "#888" }}>
                      Avg Pos
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What We're Working On */}
      <h2 className="text-lg font-extrabold mb-4" style={{ color: "#222" }}>
        What We&apos;re Working On 🛠️
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <InsightCard
          emoji="✍️"
          title="Creating Fresh Content"
          description="We're writing new blog posts and Google Business Profile posts optimized for your target keywords to help more people find your business."
        />
        <InsightCard
          emoji="📊"
          title="Tracking Your Rankings"
          description={`We're monitoring ${client._count.keywords} keywords for your business. ${page1Keywords} are already on page 1 — and we're pushing more up every week.`}
        />
        <InsightCard
          emoji="🔧"
          title="Technical Optimization"
          description="We're making sure your website loads fast, is mobile-friendly, and has all the technical elements Google looks for."
        />
        <InsightCard
          emoji="🗺️"
          title="Local SEO & Google Business"
          description="Keeping your Google Business Profile active with regular posts, updated photos, and responding to reviews to boost local visibility."
        />
      </div>

      {/* CTA to Content Review */}
      <Link
        href={`/client/${token}/content`}
        className="block rounded-2xl p-6 transition-all hover:scale-[1.01]"
        style={{
          background: "#fff0ef",
          border: "2px solid #E34234",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: "#E34234", color: "#fff" }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: "#222" }}>
                You have content waiting for your approval
              </h3>
              <p className="text-sm" style={{ color: "#666" }}>
                Review and approve your upcoming blog posts and social content
              </p>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: "#E34234" }} />
        </div>
      </Link>
    </div>
  );
}
