import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, discoveryCompleteEmail } from "@/lib/email";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

async function getCredentials() {
  let login = process.env.DATAFORSEO_LOGIN;
  let password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    const settings = await prisma.agencySettings.findUnique({ where: { id: "default" } });
    login = settings?.dataforseoLogin || undefined;
    password = settings?.dataforseoPwd || undefined;
  }
  if (!login || !password) throw new Error("DataForSEO credentials not configured");
  return { login, password };
}

function authHeader(login: string, password: string) {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

/**
 * POST /api/clients/[clientId]/discover
 * 
 * Triggers concurrent site audit + keyword discovery for a new client.
 * Uses DataForSEO keywords_for_site on client domain + competitor domains,
 * then runs Claude AI analysis to surface quick wins and recommendations.
 * Sends email notification when complete.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client?.domain) {
    return NextResponse.json({ error: "Client has no domain set" }, { status: 400 });
  }

  // Mark as discovering
  await prisma.client.update({
    where: { id: clientId },
    data: { onboardingStatus: "DISCOVERING" },
  });

  const { login, password } = await getCredentials();
  const authHdr = authHeader(login, password);

  // Parse intake data
  const serviceAreas: string[] = client.serviceAreas ? JSON.parse(client.serviceAreas) : [];
  const targetCities: string[] = client.targetCities ? JSON.parse(client.targetCities) : [];
  const competitors: string[] = client.competitors ? JSON.parse(client.competitors) : [];

  // ---- CONCURRENT: Site Audit + Keyword Discovery ----

  const auditPromise = triggerSiteAudit(clientId, client.domain, login, password, authHdr);
  const keywordPromise = discoverKeywords(
    clientId,
    client.domain,
    competitors,
    serviceAreas,
    targetCities,
    client.name,
    authHdr
  );

  const [auditResult, keywordResult] = await Promise.allSettled([auditPromise, keywordPromise]);

  // Update onboarding status
  await prisma.client.update({
    where: { id: clientId },
    data: { onboardingStatus: "COMPLETE" },
  });

  // ---- Send Email Notification ----
  const keywordsFound = keywordResult.status === "fulfilled" ? keywordResult.value.keywordsFound : 0;
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://seo.kangomedia.com";
  
  if (session.user.email) {
    const { subject, html } = discoveryCompleteEmail(
      client.name,
      client.domain,
      keywordsFound,
      clientId,
      baseUrl,
    );
    // Fire and forget — don't block the response
    sendEmail({ to: session.user.email, subject, html }).catch(() => {});
  }

  return NextResponse.json({
    audit: auditResult.status === "fulfilled" ? auditResult.value : { error: "Audit failed" },
    keywords: keywordResult.status === "fulfilled" ? keywordResult.value : { error: "Discovery failed" },
  });
}

/**
 * GET /api/clients/[clientId]/discover
 * Returns the current onboarding status and discovery results
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      onboardingStatus: true,
      serviceAreas: true,
      targetCities: true,
      competitors: true,
      siteAudits: { orderBy: { crawledAt: "desc" }, take: 1 },
      keywordResearch: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({
    onboardingStatus: client.onboardingStatus,
    latestAudit: client.siteAudits[0] || null,
    latestResearch: client.keywordResearch[0] || null,
  });
}

// ─── Site Audit ───────────────────────────────────────────

async function triggerSiteAudit(
  clientId: string,
  domain: string,
  login: string,
  password: string,
  authHdr: string,
) {
  const body = [
    {
      target: domain,
      max_crawl_pages: 30,
      enable_javascript: true,
      load_resources: false,
      enable_browser_rendering: false,
      store_raw_html: false,
    },
  ];

  const response = await fetch(`${DATAFORSEO_API}/on_page/task_post`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHdr },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[DISCOVER] Audit HTTP ${response.status}: ${errText}`);
    throw new Error(`DataForSEO audit error: ${errText}`);
  }

  const result = await response.json();
  const taskStatus = result?.tasks?.[0]?.status_code;
  const taskMsg = result?.tasks?.[0]?.status_message;
  const taskId = result?.tasks?.[0]?.id;
  
  if (taskStatus && taskStatus !== 20100) {
    console.error(`[DISCOVER] Audit task error: ${taskStatus} — ${taskMsg}`);
    // Still create a record but mark it as failed
    const audit = await prisma.siteAudit.create({
      data: { clientId, taskId: taskId || "failed", status: "FAILED" },
    });
    return { auditId: audit.id, taskId, status: "FAILED", error: taskMsg };
  }
  
  if (!taskId) throw new Error("Failed to create crawl task");

  const audit = await prisma.siteAudit.create({
    data: { clientId, taskId, status: "CRAWLING" },
  });

  console.log(`[DISCOVER] Audit started for ${domain}, taskId: ${taskId}`);
  return { auditId: audit.id, taskId, status: "CRAWLING" };
}

// ─── Keyword Discovery ───────────────────────────────────

async function discoverKeywords(
  clientId: string,
  domain: string,
  competitors: string[],
  serviceAreas: string[],
  targetCities: string[],
  clientName: string,
  authHdr: string,
) {
  // Collect keywords from domain + competitors using keywords_for_site
  const domains = [domain, ...competitors.slice(0, 3)];
  const allKeywords: Array<{
    keyword: string;
    searchVolume: number;
    competition: number;
    cpc: number;
    source: string;
  }> = [];

  for (const d of domains) {
    try {
      const cleanDomain = d.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const body = [
        {
          target: cleanDomain,
          location_name: "United States",
          language_name: "English",
          include_serp_info: true,
          limit: 100,
        },
      ];

      const response = await fetch(
        `${DATAFORSEO_API}/dataforseo_labs/google/keywords_for_site/live`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHdr },
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        const result = await response.json();
        const taskStatus = result?.tasks?.[0]?.status_code;
        const taskMsg = result?.tasks?.[0]?.status_message;
        
        if (taskStatus && taskStatus !== 20000) {
          console.error(`[DISCOVER] DataForSEO task error for ${d}: ${taskStatus} — ${taskMsg}`);
        }
        
        const items = result?.tasks?.[0]?.result?.[0]?.items || [];
        console.log(`[DISCOVER] keywords_for_site "${d}": ${items.length} keywords returned`);

        for (const item of items) {
          const kw = item?.keyword_data?.keyword;
          const info = item?.keyword_data?.keyword_info;
          if (kw && info) {
            allKeywords.push({
              keyword: kw,
              searchVolume: info.search_volume || 0,
              competition: Math.round((info.competition || 0) * 100),
              cpc: info.cpc || 0,
              source: d === domain ? "own_site" : `competitor:${d}`,
            });
          }
        }
      } else {
        const errText = await response.text();
        console.error(`[DISCOVER] keywords_for_site HTTP ${response.status} for ${d}: ${errText}`);
      }
    } catch (err) {
      console.error(`[DISCOVER] Error fetching keywords for ${d}:`, err);
    }
  }

  // Deduplicate by keyword
  const seen = new Map<string, (typeof allKeywords)[number]>();
  for (const kw of allKeywords) {
    const existing = seen.get(kw.keyword.toLowerCase());
    if (!existing || kw.searchVolume > existing.searchVolume) {
      seen.set(kw.keyword.toLowerCase(), kw);
    }
  }
  const uniqueKeywords = Array.from(seen.values())
    .sort((a, b) => b.searchVolume - a.searchVolume)
    .slice(0, 150);

  // AI Analysis via Claude
  let aiAnalysis: string | null = null;
  try {
    const anthropicKey =
      process.env.ANTHROPIC_API_KEY ||
      (await prisma.agencySettings.findUnique({ where: { id: "default" } }))?.claudeApiKey;

    if (anthropicKey && uniqueKeywords.length > 0) {
      const topKeywords = uniqueKeywords.slice(0, 80);
      const prompt = `You are an SEO strategist. A client named "${clientName}" has a website at ${domain}.

Their service areas: ${serviceAreas.length > 0 ? serviceAreas.join(", ") : "Not specified"}
Their target cities: ${targetCities.length > 0 ? targetCities.join(", ") : "Not specified"}
Competitors analyzed: ${competitors.length > 0 ? competitors.join(", ") : "None"}

Here are ${topKeywords.length} keywords discovered from their website and competitor sites:

${topKeywords.map((k, i) => `${i + 1}. "${k.keyword}" — Volume: ${k.searchVolume}, Competition: ${k.competition}%, CPC: $${k.cpc.toFixed(2)}, Source: ${k.source}`).join("\n")}

Provide a strategic analysis:
1. **Top 15 Recommended Keywords** — the keywords they should start tracking immediately, prioritized by ROI potential (good volume + low competition)
2. **Quick Wins** — keywords where they likely already have some presence and could rank with minimal effort
3. **Content Gaps** — topics their competitors rank for that they should target
4. **Local SEO Opportunities** — city-specific keywords they should create landing pages for
5. **Monthly Content Themes** — suggested blog topics for the first 3 months based on these keywords

Be specific, actionable, and focused on ROI.`;

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (anthropicRes.ok) {
        const anthropicData = await anthropicRes.json();
        aiAnalysis = anthropicData?.content?.[0]?.text || null;
      }
    }
  } catch (err) {
    console.error("[DISCOVER] AI analysis error:", err);
  }

  // Save to KeywordResearch
  const research = await prisma.keywordResearch.create({
    data: {
      clientId,
      seedTopics: `Site Discovery: ${domain}${competitors.length > 0 ? ` + ${competitors.join(", ")}` : ""}`,
      location: targetCities.length > 0 ? targetCities[0] : "United States",
      results: JSON.stringify(uniqueKeywords),
      aiAnalysis,
      keywordsFound: uniqueKeywords.length,
    },
  });

  console.log(`[DISCOVER] Found ${uniqueKeywords.length} keywords for ${domain}`);
  return {
    researchId: research.id,
    keywordsFound: uniqueKeywords.length,
    keywords: uniqueKeywords.slice(0, 20), // Return top 20 for quick preview
    aiAnalysis,
  };
}
