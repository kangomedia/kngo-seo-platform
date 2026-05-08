// POST /api/clients/[clientId]/competitors/discover
//
// 1. Pulls SERP-overlap candidates from DataForSEO competitors_domain
// 2. Asks Claude to classify each candidate (PEER, PLATFORM, DIRECTORY, etc.)
//    relative to this specific business profile + ICP
// 3. Upserts the classified rows into the Competitor table
//
// Body: { pillarSlug?: string, limit?: number, locationCode?: number }

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCompetitorsDomain } from "@/lib/dataforseo";
import { generateNarrative } from "@/lib/claude";

const CLASSIFICATIONS = [
  "PEER",
  "PLATFORM",
  "DIRECTORY",
  "MARKETPLACE",
  "TIER_MISMATCH",
  "ADJACENT",
  "IRRELEVANT",
] as const;

type Classification = (typeof CLASSIFICATIONS)[number];

interface ClassifiedCandidate {
  domain: string;
  classification: Classification;
  reasoning: string;
  domainRank?: number;
  estTraffic?: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const body = await request.json().catch(() => ({}));
  const pillarSlug: string | undefined = body.pillarSlug;
  const limit: number = body.limit || 50;
  const locationCode: number = body.locationCode || 2840;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      domain: true,
      name: true,
      industryVertical: true,
      gbpCategory: true,
      tier: true,
      priceRange: true,
      city: true,
      state: true,
      businessDescription: true,
      idealClientProfile: true,
      primaryServices: true,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!client.domain) {
    return NextResponse.json(
      { error: "Client has no domain configured" },
      { status: 400 }
    );
  }

  const dfsLogin = process.env.DATAFORSEO_LOGIN;
  const dfsPwd = process.env.DATAFORSEO_PASSWORD;
  if (!dfsLogin || !dfsPwd) {
    return NextResponse.json(
      { error: "DataForSEO credentials not configured" },
      { status: 500 }
    );
  }

  // ── 1. Pull SERP-overlap candidates ──
  let candidates: Array<{
    domain: string;
    intersections: number;
    domainRank?: number;
    estTraffic?: number;
  }> = [];
  try {
    const dfsRes = await getCompetitorsDomain(
      client.domain,
      { login: dfsLogin, password: dfsPwd },
      { locationCode, limit }
    );
    const tasks = (dfsRes?.tasks || []) as Array<{
      result?: Array<{
        items?: Array<{
          se_domain?: string;
          domain?: string;
          intersections?: number;
          full_domain_metrics?: { organic?: { count?: number; etv?: number } };
          metrics?: { organic?: { count?: number; etv?: number } };
        }>;
      }>;
    }>;
    for (const t of tasks) {
      for (const r of t.result || []) {
        for (const item of r.items || []) {
          const d = (item.domain || item.se_domain || "").toLowerCase();
          if (!d || d === client.domain.toLowerCase()) continue;
          candidates.push({
            domain: d,
            intersections: item.intersections || 0,
            estTraffic: item.metrics?.organic?.etv,
            domainRank: item.metrics?.organic?.count,
          });
        }
      }
    }
  } catch (err) {
    console.error("[competitors/discover] DataForSEO error:", err);
    return NextResponse.json(
      { error: "DataForSEO competitors_domain fetch failed" },
      { status: 502 }
    );
  }

  // De-dup and rank by intersections desc
  const seen = new Set<string>();
  candidates = candidates
    .filter((c) => {
      if (seen.has(c.domain)) return false;
      seen.add(c.domain);
      return true;
    })
    .sort((a, b) => b.intersections - a.intersections)
    .slice(0, limit);

  if (candidates.length === 0) {
    return NextResponse.json({
      message: "No SERP-overlap candidates returned",
      classified: [],
    });
  }

  // ── 2. Ask Claude to classify ──
  const services = (() => {
    try {
      return JSON.parse(client.primaryServices || "[]");
    } catch {
      return [];
    }
  })();

  const profile = `
- Name: ${client.name}
- Domain: ${client.domain}
- Industry: ${client.industryVertical || client.gbpCategory || "(unspecified)"}
- Tier: ${client.tier} · Price range: ${client.priceRange || "(unspecified)"}
- Location: ${[client.city, client.state].filter(Boolean).join(", ") || "(unspecified)"}
- Services: ${services.length > 0 ? services.join(", ") : "(unspecified)"}
- Description: ${client.businessDescription || "(none)"}
- Ideal client: ${client.idealClientProfile || "(unspecified)"}
${pillarSlug ? `- Pillar focus for this discovery: ${pillarSlug}` : ""}`.trim();

  const candidatesList = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.domain} (intersections: ${c.intersections}${
          c.domainRank ? `, ranking pages: ${c.domainRank}` : ""
        }${c.estTraffic ? `, est traffic: ${Math.round(c.estTraffic)}` : ""})`
    )
    .join("\n");

  const systemPrompt = `You are an SEO competitive-intelligence analyst. Your job is to classify each domain in the candidate list relative to the agency below — distinguishing real peer competitors from platforms, directories, and irrelevant overlap.

CLASSIFICATIONS (use exactly these strings):
- PEER          — same business model + similar tier (the agency would lose deals to them)
- PLATFORM      — DIY tool/SaaS clients use INSTEAD of an agency (Wix, Squarespace, GoDaddy, Shopify)
- DIRECTORY     — listing/aggregator/review platform (Yelp, Clutch, UpCity, Bing Places)
- MARKETPLACE   — freelancer/job platform (Fiverr, Upwork, 99Designs)
- TIER_MISMATCH — same business model but completely different tier (HubSpot, WebFX, Ignite Visibility for a small local agency)
- ADJACENT      — different category but related (SaaS vendors the agency uses or is adjacent to — e.g. GoHighLevel, ActiveCampaign)
- IRRELEVANT    — wrong category entirely (publishers, blogs, unrelated industries that happen to share keywords)

Return ONLY valid JSON in this exact shape, no surrounding prose:
{
  "classifications": [
    { "domain": "<domain>", "classification": "<CLASSIFICATION>", "reasoning": "<one sentence>" }
  ]
}

Be strict about PEER — only domains that are actually agencies or service providers competing for the same client deals at a similar tier.`;

  const userMessage = `Agency profile:
${profile}

Candidates to classify (${candidates.length} domains):
${candidatesList}

Return the JSON.`;

  let claudeResponse: string;
  try {
    claudeResponse = await generateNarrative({
      systemPrompt,
      userMessage,
    });
  } catch (err) {
    console.error("[competitors/discover] Claude error:", err);
    return NextResponse.json(
      { error: "AI classification failed" },
      { status: 502 }
    );
  }

  // Extract JSON (may or may not be wrapped in code fences)
  let parsed: { classifications?: ClassifiedCandidate[] } = {};
  try {
    const jsonMatch =
      claudeResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
      claudeResponse.match(/```\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : claudeResponse;
    parsed = JSON.parse(jsonStr.trim());
  } catch (err) {
    console.error("[competitors/discover] JSON parse error:", err, claudeResponse);
    return NextResponse.json(
      { error: "AI classification returned malformed JSON" },
      { status: 502 }
    );
  }

  const classifications = (parsed.classifications || []).filter((c) =>
    CLASSIFICATIONS.includes(c.classification)
  );

  // ── 3. Upsert into Competitor table ──
  // Default acceptance rule: PEER auto-accepts; everything else requires the
  // user to manually flip it. ADJACENT we leave as not-accepted-by-default
  // since the user might want it for a specific pillar.
  const upserted = [];
  for (const c of classifications) {
    const candidateMeta = candidates.find((x) => x.domain === c.domain);
    const isAccepted = c.classification === "PEER";
    try {
      const row = await prisma.competitor.upsert({
        where: { clientId_domain: { clientId, domain: c.domain } },
        create: {
          clientId,
          domain: c.domain,
          classification: c.classification,
          reasoning: c.reasoning,
          pillarSlug: pillarSlug || null,
          isAccepted,
          source: "discovery",
          domainRank: candidateMeta?.domainRank ?? null,
          estTraffic: candidateMeta?.estTraffic
            ? Math.round(candidateMeta.estTraffic)
            : null,
        },
        update: {
          // Re-running discovery refines classification + reasoning but
          // doesn't override a manual isAccepted decision.
          classification: c.classification,
          reasoning: c.reasoning,
          ...(pillarSlug ? { pillarSlug } : {}),
          domainRank: candidateMeta?.domainRank ?? undefined,
          estTraffic: candidateMeta?.estTraffic
            ? Math.round(candidateMeta.estTraffic)
            : undefined,
        },
      });
      upserted.push(row);
    } catch (err) {
      console.warn("[competitors/discover] upsert failed", c.domain, err);
    }
  }

  // Counts for UX
  const counts = upserted.reduce<Record<string, number>>((acc, r) => {
    acc[r.classification] = (acc[r.classification] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    discovered: upserted.length,
    counts,
    competitors: upserted,
  });
}
