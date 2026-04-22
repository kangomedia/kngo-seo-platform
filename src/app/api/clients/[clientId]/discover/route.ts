import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, discoveryCompleteEmail } from "@/lib/email";

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

  const keywordPromise = discoverKeywords(
    clientId,
    client.domain,
    competitors,
    serviceAreas,
    targetCities,
    client.name,
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
  const body = [
    {
      target: targetDomain,
      max_crawl_pages: 30,
      enable_javascript: true,
      load_resources: false,
      enable_browser_rendering: false,
      store_raw_html: false,
      custom_sitemap: `${targetDomain}/sitemap.xml`,
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
          const kwData = item?.keyword_data || item;
          const kw = kwData?.keyword;
          const info = kwData?.keyword_info;
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

  // ── Fallback: If keywords_for_site returned nothing, use seed-based discovery ──
  if (allKeywords.length === 0) {
    console.log(`[DISCOVER] keywords_for_site returned 0 results. Falling back to seed-based discovery.`);
    
    // Build seed topics from service areas, business name, and target cities
    const seeds: string[] = [];
    if (serviceAreas.length > 0) seeds.push(...serviceAreas.slice(0, 3));
    if (seeds.length === 0) {
      // Use business name + common industry terms as fallback seeds
      seeds.push(clientName);
    }
    // Add location-qualified variations
    const primaryCity = targetCities.length > 0 ? targetCities[0] : null;
    if (primaryCity && seeds.length > 0) {
      const locationSeeds = seeds.slice(0, 2).map(s => `${s} ${primaryCity}`);
      seeds.push(...locationSeeds);
    }
    
    console.log(`[DISCOVER] Seed-based fallback using: ${seeds.join(", ")}`);
    
    for (const seed of seeds.slice(0, 5)) {
      try {
        const body = [
          {
            keywords: [seed.trim()],
            location_code: 2840, // United States
            language_code: "en",
            include_seed_keyword: true,
            sort_by: "search_volume",
          },
        ];

        const response = await fetch(
          `${DATAFORSEO_API}/keywords_data/google_ads/keywords_for_keywords/live`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHdr },
            body: JSON.stringify(body),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const items = result?.tasks?.[0]?.result || [];
          console.log(`[DISCOVER] keywords_for_keywords "${seed}": ${items.length} keywords returned`);

          for (const item of items) {
            if (item.keyword && item.search_volume > 0) {
              allKeywords.push({
                keyword: item.keyword,
                searchVolume: item.search_volume || 0,
                competition: item.competition ? Math.round(item.competition * 100) : 0,
                cpc: item.cpc || 0,
                source: `seed:${seed}`,
              });
            }
          }
        } else {
          const errText = await response.text();
          console.error(`[DISCOVER] keywords_for_keywords HTTP ${response.status} for "${seed}": ${errText}`);
        }
      } catch (err) {
        console.error(`[DISCOVER] Error in seed fallback for "${seed}":`, err);
      }
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
          model: "claude-3-5-sonnet-20241022",
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
  try {
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
    console.log(`[DISCOVER] Successfully saved ${uniqueKeywords.length} keywords for ${domain} to DB.`);
    return {
      researchId: research.id,
      keywordsFound: uniqueKeywords.length,
      keywords: uniqueKeywords.slice(0, 20), // Return top 20 for quick preview
      aiAnalysis,
    };
  } catch (err) {
    console.error("[DISCOVER] CRITICAL ERROR saving KeywordResearch to DB:", err);
    throw err;
  }
}
