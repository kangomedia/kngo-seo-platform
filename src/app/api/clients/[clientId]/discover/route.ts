import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, discoveryCompleteEmail } from "@/lib/email";
import {
  type BusinessProfile,
  type RawKeyword,
  generateSmartSeeds,
  filterByNegativePatterns,
  filterByIntent,
  scoreKeywordRelevance,
  generateStrategicAnalysis,
} from "@/lib/keyword-intelligence";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

function getDataForSEOAuth() {
  let login = process.env.DATAFORSEO_LOGIN;
  let password = process.env.DATAFORSEO_PASSWORD;

  if (login && password) {
    return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
  }
  return null;
}

/**
 * POST /api/clients/[clientId]/discover
 * Triggers the remote discovery process (Site Audit + Keyword Discovery + Content Map)
 * Does not block the HTTP response since these tasks take >3-5 minutes.
 */
export async function POST(
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
      id: true,
      name: true,
      domain: true,
      tier: true,
      onboardingStatus: true,
      serviceAreas: true,
      targetCities: true,
      competitors: true,
      businessDescription: true,
      primaryServices: true,
      idealClientProfile: true,
      priceRange: true,
      industryVertical: true,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (!client.domain) {
    return NextResponse.json({ error: "Client domain is required for discovery" }, { status: 400 });
  }

  const authHdr = getDataForSEOAuth();
  if (!authHdr) {
    console.warn("DataForSEO credentials missing. Discovery cannot proceed.");
    return NextResponse.json({ error: "DataForSEO credentials missing" }, { status: 500 });
  }

  // Update status to DISCOVERING
  await prisma.client.update({
    where: { id: clientId },
    data: { onboardingStatus: "DISCOVERING" },
  });

  // Parse JSON string fields from DB into actual arrays
  const competitors: string[] = (() => { try { return JSON.parse(client.competitors || "[]"); } catch { return []; } })();
  const serviceAreas: string[] = (() => { try { return JSON.parse(client.serviceAreas || "[]"); } catch { return []; } })();
  const targetCities: string[] = (() => { try { return JSON.parse(client.targetCities || "[]"); } catch { return []; } })();

  // Start background pipeline
  const auditPromise = triggerSiteAudit(
    clientId,
    client.domain,
    process.env.DATAFORSEO_LOGIN || "",
    process.env.DATAFORSEO_PASSWORD || "",
    authHdr
  );

  // Parse business profile fields
  const primaryServices: string[] = (() => { try { return JSON.parse(client.primaryServices || "[]"); } catch { return []; } })();

  const businessProfile: BusinessProfile = {
    clientName: client.name,
    domain: client.domain,
    businessDescription: client.businessDescription || null,
    primaryServices,
    idealClientProfile: client.idealClientProfile || null,
    priceRange: client.priceRange || null,
    industryVertical: client.industryVertical || null,
    serviceAreas,
    targetCities,
  };

  const keywordPromise = discoverKeywords(
    clientId,
    client.domain,
    competitors,
    businessProfile,
    authHdr
  );

  // Run them concurrently but wait for both
  const [auditResult, keywordResult] = await Promise.allSettled([auditPromise, keywordPromise]);

  const auditSuccess = auditResult.status === "fulfilled" && auditResult.value?.status !== "FAILED";
  const keywordSuccess = keywordResult.status === "fulfilled";

  // Mark status as COMPLETE
  await prisma.client.update({
    where: { id: clientId },
    data: {
      onboardingStatus: "COMPLETE",
    },
  });

  // Fire off notification email to user that discovery is complete
  if (session.user?.email) {
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = request.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;
    
    // Check keywords found safely by handling the successful promise result
    const kwFound = keywordResult.status === "fulfilled" && keywordResult.value 
      ? keywordResult.value.keywordsFound 
      : 0;

    const { subject, html } = discoveryCompleteEmail(
      client.name,
      client.domain,
      kwFound,
      clientId,
      baseUrl
    );
    
    // Fire and forget — don't block the response
    sendEmail({ to: session.user.email, subject, html }).catch(() => {});
  }

  return NextResponse.json({
    audit: auditResult.status === "fulfilled" ? auditResult.value : { error: "Audit failed", details: String(auditResult.reason) },
    keywords: keywordResult.status === "fulfilled" ? keywordResult.value : { error: "Discovery failed", details: String(keywordResult.reason) },
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
  // if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

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

  const latestResearch = client.keywordResearch[0] || null;
  return NextResponse.json({
    onboardingStatus: client.onboardingStatus,
    latestAudit: client.siteAudits[0] || null,
    latestResearch: latestResearch ? {
      ...latestResearch,
      results: latestResearch.results || "[]",
    } : null,
  });
}

// ─── Site Audit ───────────────────────────────────────────

/** Small helper: wait N ms */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function triggerSiteAudit(
  clientId: string,
  domain: string,
  login: string,
  password: string,
  authHdr: string,
) {
  const headers = { "Content-Type": "application/json", Authorization: authHdr };

  // Ensure domain has protocol
  let targetDomain = domain;
  if (!targetDomain.startsWith("http://") && !targetDomain.startsWith("https://")) {
    targetDomain = `https://${targetDomain}`;
  }

  // ── Step 1: Create the crawl task ──
  // Lightweight crawl for onboarding — full audit handles deep analysis
  const body = [
    {
      target: targetDomain,
      max_crawl_pages: 30,

      // Rendering — lightweight (no browser rendering for speed)
      enable_javascript: true,
      load_resources: false,
      enable_browser_rendering: false,
      support_cookies: true,

      // Sitemap
      respect_sitemap: true,
      custom_sitemap: `${targetDomain}/sitemap.xml`,

      // Storage
      store_raw_html: false,

      // Custom thresholds — match audit settings
      checks_threshold: {
        title_too_long: 60,
        low_content_rate: 0.15,
      },
    },
  ];

  const response = await fetch(`${DATAFORSEO_API}/on_page/task_post`, {
    method: "POST",
    headers,
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

  // ── Step 2: Poll until crawl finishes (up to ~10 minutes) ──
  const MAX_ATTEMPTS = 40; // 40 × 15s = 10 min
  let crawlFinished = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await sleep(15_000); // wait 15 seconds between polls

    try {
      const summaryRes = await fetch(`${DATAFORSEO_API}/on_page/summary/${taskId}`, {
        method: "GET",
        headers: { Authorization: authHdr },
      });

      if (!summaryRes.ok) {
        console.warn(`[DISCOVER] Summary poll ${attempt} failed: HTTP ${summaryRes.status}`);
        continue;
      }

      const summaryData = await summaryRes.json();
      const summaryResult = summaryData?.tasks?.[0]?.result?.[0];

      if (!summaryResult) {
        console.log(`[DISCOVER] Poll ${attempt}/${MAX_ATTEMPTS}: no result yet`);
        continue;
      }

      const progress = summaryResult.crawl_progress || "unknown";
      const pagesCrawled = summaryResult.pages_crawled || 0;
      console.log(`[DISCOVER] Poll ${attempt}/${MAX_ATTEMPTS}: ${progress}, ${pagesCrawled} pages`);

      // Update the DB with progress
      await prisma.siteAudit.update({
        where: { id: audit.id },
        data: { pagesCount: pagesCrawled },
      });

      if (progress === "finished") {
        crawlFinished = true;

        // ── Step 3: Fetch page-level data ──
        const pagesRes = await fetch(`${DATAFORSEO_API}/on_page/pages`, {
          method: "POST",
          headers,
          body: JSON.stringify([
            {
              id: taskId,
              limit: 100,
              order_by: ["meta.external_links_count,desc"],
              filters: ["resource_type", "=", "html"],
            },
          ]),
        });

        const pages = pagesRes.ok
          ? (await pagesRes.json())?.tasks?.[0]?.result?.[0]?.items || []
          : [];

        // ── Step 4: Build + store page records ──
        const pageRecords = pages.map((page: Record<string, unknown>) => {
          const meta = (page.meta as Record<string, unknown>) || {};
          const checks = (page.checks as Record<string, unknown>) || {};
          const onpage = (page.onpage_score as number) || null;
          return {
            auditId: audit.id,
            url: (page.url as string) || "",
            statusCode: (page.status_code as number) || null,
            title: (meta.title as string) || null,
            description: (meta.description as string) || null,
            h1Count: (meta.htags as Record<string, string[]>)?.h1?.length || 0,
            wordCount: ((meta.content as Record<string, unknown>)?.plain_text_word_count as number) || 0,
            imageCount: (meta.images_count as number) || 0,
            imagesNoAlt: (meta.images_without_alt_count as number) || 0,
            checks: JSON.stringify(checks),
            onpageScore: onpage,
          };
        });

        // Compute health score with fallback from per-page scores
        let onpageScore = summaryResult.onpage_score || null;
        if (onpageScore === null && pageRecords.length > 0) {
          const validScores = pageRecords
            .map((p: { onpageScore: number | null }) => p.onpageScore)
            .filter((s: number | null): s is number => s !== null);
          if (validScores.length > 0) {
            onpageScore = Math.round(validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length * 10) / 10;
          }
        }

        await prisma.$transaction([
          prisma.siteAuditPage.deleteMany({ where: { auditId: audit.id } }),
          ...pageRecords.map(
            (p: { auditId: string; url: string; statusCode: number | null; title: string | null; description: string | null; h1Count: number; wordCount: number; imageCount: number; imagesNoAlt: number; checks: string; onpageScore: number | null }) =>
              prisma.siteAuditPage.create({ data: p })
          ),
          prisma.siteAudit.update({
            where: { id: audit.id },
            data: {
              status: "COMPLETED",
              pagesCount: pages.length,
              onpageScore,
              summary: JSON.stringify({
                crawl_progress: summaryResult.crawl_progress,
                crawl_status: summaryResult.crawl_status,
                pages_count: summaryResult.pages_count,
                pages_crawled: summaryResult.pages_crawled,
                onpage_score: onpageScore,
                checks: summaryResult.page_metrics?.checks || {},
              }),
            },
          }),
        ]);

        console.log(`[DISCOVER] Audit COMPLETED: ${pages.length} pages, score=${onpageScore}`);
        return { auditId: audit.id, taskId, status: "COMPLETED", pagesCount: pages.length, onpageScore };
      }
    } catch (err) {
      console.error(`[DISCOVER] Poll ${attempt} error:`, err);
    }
  }

  // If we exhausted our attempts without finishing, mark as timed out
  if (!crawlFinished) {
    console.warn(`[DISCOVER] Audit timed out after ${MAX_ATTEMPTS} attempts for taskId=${taskId}`);
    await prisma.siteAudit.update({
      where: { id: audit.id },
      data: { status: "COMPLETED" }, // Mark complete so it doesn't block — data is partial
    });
    return { auditId: audit.id, taskId, status: "TIMEOUT" };
  }

  return { auditId: audit.id, taskId, status: "CRAWLING" };
}

// ─── Keyword Discovery ───────────────────────────────────

async function discoverKeywords(
  clientId: string,
  domain: string,
  competitors: string[],
  profile: BusinessProfile,
  authHdr: string,
) {
  const allKeywords: RawKeyword[] = [];

  // ── Stage 1: Smart Seed-Based Discovery (keyword_suggestions) ──
  const seeds = generateSmartSeeds(profile);
  console.log(`[DISCOVER] Generated ${seeds.length} smart seeds: ${seeds.slice(0, 5).join(", ")}...`);

  for (const seed of seeds.slice(0, 15)) {
    try {
      const body = [
        {
          keyword: seed,
          location_name: "United States",
          language_name: "English",
          include_seed_keyword: true,
          limit: 50,
        },
      ];

      const response = await fetch(
        `${DATAFORSEO_API}/dataforseo_labs/google/keyword_suggestions/live`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHdr },
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        const result = await response.json();
        const taskStatus = result?.tasks?.[0]?.status_code;
        if (taskStatus && taskStatus !== 20000) {
          console.error(`[DISCOVER] keyword_suggestions task error for "${seed}": ${taskStatus}`);
          continue;
        }

        const items = result?.tasks?.[0]?.result?.[0]?.items || [];
        console.log(`[DISCOVER] keyword_suggestions "${seed}": ${items.length} keywords returned`);

        for (const item of items) {
          const kw = item?.keyword;
          const info = item?.keyword_info;
          const intentInfo = item?.search_intent_info;
          if (kw && info && info.search_volume > 0) {
            allKeywords.push({
              keyword: kw,
              searchVolume: info.search_volume || 0,
              competition: Math.round((info.competition || 0) * 100),
              cpc: info.cpc || 0,
              source: `seed:${seed}`,
              intent: intentInfo?.main_intent || null,
            });
          }
        }
      } else {
        const errText = await response.text();
        console.error(`[DISCOVER] keyword_suggestions HTTP ${response.status} for "${seed}": ${errText}`);
      }
    } catch (err) {
      console.error(`[DISCOVER] Error in keyword_suggestions for "${seed}":`, err);
    }
  }

  // ── Stage 2: Competitor Gap Analysis (keywords_for_site) ──
  // Still use keywords_for_site for competitor domains to find gap opportunities
  const competitorDomains = competitors.slice(0, 3);
  for (const d of competitorDomains) {
    try {
      const cleanDomain = d.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const body = [
        {
          target: cleanDomain,
          location_name: "United States",
          language_name: "English",
          limit: 80,
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
        const items = result?.tasks?.[0]?.result?.[0]?.items || [];
        console.log(`[DISCOVER] keywords_for_site competitor "${d}": ${items.length} keywords`);

        for (const item of items) {
          const kwData = item?.keyword_data || item;
          const kw = kwData?.keyword;
          const info = kwData?.keyword_info;
          const intentInfo = kwData?.search_intent_info || item?.search_intent_info;
          if (kw && info) {
            allKeywords.push({
              keyword: kw,
              searchVolume: info.search_volume || 0,
              competition: Math.round((info.competition || 0) * 100),
              cpc: info.cpc || 0,
              source: `competitor:${d}`,
              intent: intentInfo?.main_intent || null,
            });
          }
        }
      }
    } catch (err) {
      console.error(`[DISCOVER] Error fetching competitor keywords for ${d}:`, err);
    }
  }

  console.log(`[DISCOVER] Total raw keywords collected: ${allKeywords.length}`);

  // ── Stage 3: Deduplicate ──
  const seen = new Map<string, RawKeyword>();
  for (const kw of allKeywords) {
    const key = kw.keyword.toLowerCase();
    const existing = seen.get(key);
    if (!existing || kw.searchVolume > existing.searchVolume) {
      seen.set(key, kw);
    }
  }
  let filtered = Array.from(seen.values());
  console.log(`[DISCOVER] After dedup: ${filtered.length} keywords`);

  // ── Stage 4: Negative Pattern Filter ──
  filtered = filterByNegativePatterns(filtered);
  console.log(`[DISCOVER] After negative pattern filter: ${filtered.length} keywords`);

  // ── Stage 5: Intent Filter ──
  filtered = filterByIntent(filtered);
  console.log(`[DISCOVER] After intent filter: ${filtered.length} keywords`);

  // ── Stage 6: AI Relevance Scoring ──
  const anthropicKey =
    process.env.ANTHROPIC_API_KEY ||
    (await prisma.agencySettings.findUnique({ where: { id: "default" } }))?.claudeApiKey;

  let scoredKeywords = filtered.map(kw => ({
    ...kw,
    intent: kw.intent || "unknown",
    relevanceScore: 5,
    relevanceReason: "Default score — AI scoring not available",
    suggestedGroup: "General",
  }));

  if (anthropicKey && filtered.length > 0) {
    console.log(`[DISCOVER] Running AI relevance scoring on ${filtered.length} keywords...`);
    const aiScored = await scoreKeywordRelevance(filtered, profile, anthropicKey);
    if (aiScored.length > 0) {
      scoredKeywords = aiScored;
      console.log(`[DISCOVER] AI scoring complete: ${aiScored.length} keywords passed (score ≥ 4)`);
    }
  }

  // Limit to top 80
  const finalKeywords = scoredKeywords.slice(0, 80);

  // ── Stage 7: Strategic Analysis ──
  let aiAnalysis: string | null = null;
  if (anthropicKey && finalKeywords.length > 0) {
    console.log(`[DISCOVER] Generating strategic analysis...`);
    aiAnalysis = await generateStrategicAnalysis(finalKeywords, profile, anthropicKey);
  }

  // ── Save to KeywordResearch ──
  try {
    const research = await prisma.keywordResearch.create({
      data: {
        clientId,
        seedTopics: seeds.join(", "),
        location: profile.targetCities.length > 0 ? profile.targetCities[0] : "United States",
        results: JSON.stringify(finalKeywords),
        aiAnalysis,
        keywordsFound: finalKeywords.length,
      },
    });
    console.log(`[DISCOVER] Saved ${finalKeywords.length} scored keywords for ${domain} to DB.`);
    return {
      researchId: research.id,
      keywordsFound: finalKeywords.length,
      keywords: finalKeywords.slice(0, 20),
      aiAnalysis,
    };
  } catch (err) {
    console.error("[DISCOVER] CRITICAL ERROR saving KeywordResearch to DB:", err);
    throw err;
  }
}

