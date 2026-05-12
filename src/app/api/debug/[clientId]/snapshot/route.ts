// Debug snapshot endpoint — read-only, header-token gated.
//
// Designed to be hit by WebFetch from an external assistant for inspection.
// Returns 8 buckets: client config, business profile, keywords, latest keyword
// research, active content maps, latest site audit, deliverables, recent activity.
//
// Auth model: presence of an `x-debug-token` header matching the
// DEBUG_TOKEN env var. No DB writes, ever — all queries are read-only.
//
// PII: not masked. The token + non-public deployment are the security boundary.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function safeParseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

interface ActivityEvent {
  at: Date;
  type: string;
  description: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const expected = process.env.DEBUG_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "DEBUG_TOKEN env var is not set on this deployment" },
      { status: 503 }
    );
  }
  const provided = request.headers.get("x-debug-token");
  if (!provided || provided !== expected) return unauthorized();

  const { clientId } = await params;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // ── Bucket 1: Client config ──────────────────────────
  const clientConfig = {
    id: client.id,
    name: client.name,
    domain: client.domain,
    tier: client.tier,
    isActive: client.isActive,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    contactPhone: client.contactPhone,
    address: client.address,
    city: client.city,
    state: client.state,
    zip: client.zip,
    notes: client.notes,
    gbp: {
      name: client.gbpName,
      url: client.gbpUrl,
      phone: client.gbpPhone,
      address: client.gbpAddress,
      category: client.gbpCategory,
    },
    deliverableDefaults: {
      monthlyBlogs: client.monthlyBlogs,
      monthlyGbpPosts: client.monthlyGbpPosts,
      monthlyGbpQAs: client.monthlyGbpQAs,
      monthlyPressReleases: client.monthlyPressReleases,
      monthlyDirectoryListings: client.monthlyDirectoryListings,
      includesAudit: client.includesAudit,
      includesReporting: client.includesReporting,
    },
    google: {
      gscProperty: client.gscProperty,
      ga4PropertyId: client.ga4PropertyId,
    },
    sitemapUrl: client.sitemapUrl,
    wordpress: {
      url: client.wpUrl,
      username: client.wpUsername,
      hasPassword: !!client.wpAppPasswordEnc,
    },
    performance: {
      brandTerms: safeParseJson<string[]>(client.brandTerms, []),
      avgCpcUsd: client.avgCpcUsd,
    },
  };

  // ── Bucket 2: Business profile ───────────────────────
  const businessProfile = {
    onboardingStatus: client.onboardingStatus,
    serviceAreas: safeParseJson<string[]>(client.serviceAreas, []),
    targetCities: safeParseJson<string[]>(client.targetCities, []),
    competitors: safeParseJson<string[]>(client.competitors, []),
    businessDescription: client.businessDescription,
    primaryServices: safeParseJson<string[]>(client.primaryServices, []),
    idealClientProfile: client.idealClientProfile,
    priceRange: client.priceRange,
    industryVertical: client.industryVertical,
    industrySector: client.industrySector,
    icpPains: safeParseJson<string[]>(client.icpPains, []),
  };

  // ── Bucket 4: Keywords ───────────────────────────────
  const keywordRows = await prisma.keyword.findMany({
    where: { clientId },
    orderBy: { keyword: "asc" },
    include: {
      snapshots: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });
  const keywords = keywordRows.map((k) => ({
    id: k.id,
    keyword: k.keyword,
    searchVolume: k.searchVolume,
    difficulty: k.difficulty,
    targetUrl: k.targetUrl,
    group: k.group,
    isTracking: k.isTracking,
    createdAt: k.createdAt,
    latestPosition: k.snapshots[0]?.position ?? null,
    latestPositionUrl: k.snapshots[0]?.url ?? null,
    latestCheckedAt: k.snapshots[0]?.checkedAt ?? null,
  }));

  // ── Bucket 6: Keyword research — full history + most recent details ──
  const allResearch = await prisma.keywordResearch.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });
  const keywordResearch = {
    history: allResearch.map((r) => ({
      id: r.id,
      mode: r.mode,
      pillarSlug: r.pillarSlug,
      keywordsFound: r.keywordsFound,
      seedTopicsPreview: r.seedTopics.slice(0, 200) + (r.seedTopics.length > 200 ? "…" : ""),
      seedCount: r.seedTopics.split(",").length,
      createdAt: r.createdAt,
    })),
    mostRecent: allResearch[0]
      ? {
          id: allResearch[0].id,
          mode: allResearch[0].mode,
          pillarSlug: allResearch[0].pillarSlug,
          seedTopics: allResearch[0].seedTopics,
          location: allResearch[0].location,
          keywordsFound: allResearch[0].keywordsFound,
          createdAt: allResearch[0].createdAt,
          results: safeParseJson<unknown[]>(allResearch[0].results, []),
          aiAnalysis: allResearch[0].aiAnalysis,
        }
      : null,
  };

  // ── Bucket 7: Active content maps ────────────────────
  const contentMapRows = await prisma.contentMap.findMany({
    where: { clientId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  const contentMaps = contentMapRows.map((m) => ({
    id: m.id,
    title: m.title,
    isActive: m.isActive,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    mapData: safeParseJson<unknown>(m.mapData, null),
    aiSummary: m.aiSummary,
  }));

  // ── Bucket 20: Latest site audit ─────────────────────
  const audit = await prisma.siteAudit.findFirst({
    where: { clientId, archivedAt: null },
    orderBy: { crawledAt: "desc" },
    include: {
      pages: {
        orderBy: { onpageScore: "asc" },
        take: 25, // worst pages first; cap to keep payload sane
        include: {
          issues: {
            where: { status: "OPEN" },
            select: {
              id: true,
              checkKey: true,
              severity: true,
              currentValue: true,
              suggestion: true,
            },
          },
        },
      },
    },
  });
  const siteAudit = audit
    ? {
        id: audit.id,
        status: audit.status,
        pagesCount: audit.pagesCount,
        onpageScore: audit.onpageScore,
        crawledAt: audit.crawledAt,
        summary: safeParseJson<unknown>(audit.summary, null),
        worstPages: audit.pages.map((p) => ({
          id: p.id,
          url: p.url,
          statusCode: p.statusCode,
          title: p.title,
          description: p.description,
          h1Count: p.h1Count,
          wordCount: p.wordCount,
          imageCount: p.imageCount,
          imagesNoAlt: p.imagesNoAlt,
          onpageScore: p.onpageScore,
          openIssues: p.issues,
        })),
      }
    : null;

  // ── Bucket 23: Deliverables (current + previous month) ──
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const deliverableRows = await prisma.deliverable.findMany({
    where: {
      clientId,
      OR: [
        { month: currentMonth, year: currentYear },
        { month: prevMonth, year: prevYear },
      ],
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { name: "asc" }],
  });
  const deliverables = deliverableRows.map((d) => ({
    id: d.id,
    month: d.month,
    year: d.year,
    name: d.name,
    targetCount: d.targetCount,
    currentCount: d.currentCount,
    status: d.status,
    notes: d.notes,
    completedAt: d.completedAt,
    progressPct: d.targetCount > 0
      ? Math.round((d.currentCount / d.targetCount) * 100)
      : 0,
  }));

  // ── Bucket 24: Recent activity (assembled from createdAt) ──
  // Pull a small slice from each table, fold into one timeline, take last 20.
  const since = new Date();
  since.setDate(since.getDate() - 60); // last 60 days

  const [
    recentKeywords,
    recentRankRuns,
    recentPieces,
    recentApprovals,
    recentReports,
    recentAudits,
    recentResearchRuns,
    recentMaps,
    recentDeliverableCompletions,
  ] = await Promise.all([
    prisma.keyword.findMany({
      where: { clientId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Group rank snapshots by date — counts how many keywords we checked per day
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT date_trunc('day', "checkedAt") AS day, COUNT(*) AS n
      FROM "RankSnapshot"
      WHERE "clientId" = ${clientId}
        AND "checkedAt" >= ${since}
      GROUP BY day
      ORDER BY day DESC
      LIMIT 10
    `,
    prisma.contentPiece.findMany({
      where: {
        contentPlan: { clientId },
        OR: [
          { createdAt: { gte: since } },
          { publishedAt: { gte: since } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    prisma.contentApproval.findMany({
      where: {
        decidedAt: { gte: since },
        contentPiece: { contentPlan: { clientId } },
      },
      orderBy: { decidedAt: "desc" },
      take: 10,
      include: { contentPiece: { select: { title: true } } },
    }),
    prisma.report.findMany({
      where: { clientId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.siteAudit.findMany({
      where: { clientId, crawledAt: { gte: since } },
      orderBy: { crawledAt: "desc" },
      take: 5,
    }),
    prisma.keywordResearch.findMany({
      where: { clientId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.contentMap.findMany({
      where: { clientId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.deliverable.findMany({
      where: { clientId, completedAt: { gte: since } },
      orderBy: { completedAt: "desc" },
      take: 5,
    }),
  ]);

  const events: ActivityEvent[] = [];

  for (const k of recentKeywords) {
    events.push({
      at: k.createdAt,
      type: "keyword_added",
      description: `Keyword tracked: "${k.keyword}"`,
    });
  }
  for (const r of recentRankRuns) {
    events.push({
      at: r.day,
      type: "rank_check",
      description: `Rank check run — ${Number(r.n)} keyword position${
        Number(r.n) === 1 ? "" : "s"
      } recorded`,
    });
  }
  for (const p of recentPieces) {
    if (p.publishedAt && p.publishedAt >= since) {
      events.push({
        at: p.publishedAt,
        type: "content_published",
        description: `Published: "${p.title}" → ${p.publishedUrl ?? "(no URL)"}`,
      });
    } else if (p.createdAt >= since) {
      events.push({
        at: p.createdAt,
        type: "content_created",
        description: `${p.type} drafted: "${p.title}"`,
      });
    }
  }
  for (const a of recentApprovals) {
    events.push({
      at: a.decidedAt,
      type: `approval_${a.outcome}`,
      description: `Client ${a.outcome.replace("_", " ")}: "${a.contentPiece.title}"${
        a.notes ? ` — "${a.notes.slice(0, 120)}"` : ""
      }`,
    });
  }
  for (const r of recentReports) {
    events.push({
      at: r.createdAt,
      type: "report_generated",
      description: `${r.type} report: ${r.title}`,
    });
  }
  for (const a of recentAudits) {
    events.push({
      at: a.crawledAt,
      type: "site_audit_run",
      description: `Site audit ${a.status.toLowerCase()} — ${a.pagesCount} pages, score ${
        a.onpageScore?.toFixed?.(0) ?? "—"
      }`,
    });
  }
  for (const r of recentResearchRuns) {
    events.push({
      at: r.createdAt,
      type: "keyword_research_run",
      description: `Keyword research: ${r.keywordsFound} keywords from "${r.seedTopics}"`,
    });
  }
  for (const m of recentMaps) {
    events.push({
      at: m.createdAt,
      type: "content_map_created",
      description: `Content map: ${m.title}`,
    });
  }
  for (const d of recentDeliverableCompletions) {
    if (d.completedAt) {
      events.push({
        at: d.completedAt,
        type: "deliverable_completed",
        description: `Deliverable completed: ${d.name} (${d.month}/${d.year})`,
      });
    }
  }

  const recentActivity = events
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 20)
    .map((e) => ({ ...e, at: e.at.toISOString() }));

  // ── Response ─────────────────────────────────────────
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    clientId,
    buckets: {
      clientConfig,
      businessProfile,
      keywords,
      keywordResearch,
      contentMaps,
      siteAudit,
      deliverables,
      recentActivity,
    },
  });
}
