import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TIER_DEFAULTS } from "@/lib/tier-config";

/**
 * POST /api/clients/[clientId]/content-map
 * Generate an AI-powered content strategy map from keyword research.
 * Body: { researchId?: string, keywords?: Array, title?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" &&
      session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const body = await request.json();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      domain: true,
      city: true,
      state: true,
      gbpCategory: true,
      tier: true,
      monthlyBlogs: true,
      monthlyGbpPosts: true,
      monthlyGbpQAs: true,
      monthlyPressReleases: true,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Get keywords from one or more research sessions, or pass them directly.
  // Multi-research is the normal mode — service research + pain-point research
  // both feed into a single content map so pillars can span the full business.
  type ResearchKw = {
    keyword: string;
    searchVolume: number;
    competition: number;
    cpc: number;
    source?: string;
    intent?: string | null;
    suggestedGroup?: string;
    relevanceScore?: number;
  };
  const researchIds: string[] = Array.isArray(body.researchIds)
    ? body.researchIds
    : body.researchId
      ? [body.researchId]
      : [];

  let keywords: ResearchKw[] = [];
  // Track which mode each keyword came from so the prompt can spread pieces
  // across pillars informed by both demand-capture and demand-creation data.
  const keywordModes = new Map<string, string>();

  if (researchIds.length > 0) {
    const researches = await prisma.keywordResearch.findMany({
      where: { id: { in: researchIds }, clientId },
    });
    for (const r of researches) {
      try {
        const arr: ResearchKw[] = JSON.parse(r.results || "[]");
        for (const kw of arr) {
          keywords.push(kw);
          keywordModes.set(kw.keyword.toLowerCase(), r.mode);
        }
      } catch {
        /* skip malformed */
      }
    }
  } else if (body.keywords && Array.isArray(body.keywords)) {
    keywords = body.keywords;
  } else {
    // Default: fold ALL active research sessions for this client into one map.
    const all = await prisma.keywordResearch.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    for (const r of all) {
      try {
        const arr: ResearchKw[] = JSON.parse(r.results || "[]");
        for (const kw of arr) {
          keywords.push(kw);
          keywordModes.set(kw.keyword.toLowerCase(), r.mode);
        }
      } catch {
        /* skip */
      }
    }
  }

  // Dedupe by keyword (keep highest-volume occurrence)
  const seen = new Map<string, ResearchKw>();
  for (const kw of keywords) {
    const key = kw.keyword.toLowerCase();
    const existing = seen.get(key);
    if (!existing || (kw.searchVolume || 0) > (existing.searchVolume || 0)) {
      seen.set(key, kw);
    }
  }
  keywords = Array.from(seen.values());

  if (keywords.length === 0) {
    return NextResponse.json(
      { error: "No keywords found. Run keyword research (and optionally pain-point research) first." },
      { status: 400 }
    );
  }

  // Claude key is read exclusively from environment variables.
  const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  if (!claudeKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY environment variable is not set." },
      { status: 500 }
    );
  }

  const locationStr = client.city && client.state
    ? `${client.city}, ${client.state}`
    : "United States";

  // Capacity comes from the purchased package (tier), not the stored
  // per-client fields. Those fields were auto-copied at client creation but
  // can go stale if the tier changes without a manual resave. Driving from
  // TIER_DEFAULTS guarantees the strategy always matches the package the
  // client is actually on.
  const tierDefaults = TIER_DEFAULTS[client.tier] ?? {
    monthlyBlogs: client.monthlyBlogs,
    monthlyGbpPosts: client.monthlyGbpPosts,
    monthlyGbpQAs: client.monthlyGbpQAs,
    monthlyPressReleases: client.monthlyPressReleases,
  };
  const monthlyCapacity = {
    blogs: tierDefaults.monthlyBlogs,
    gbpPosts: tierDefaults.monthlyGbpPosts,
    gbpQAs: tierDefaults.monthlyGbpQAs,
    pressReleases: tierDefaults.monthlyPressReleases,
  };
  // 6-month totals — the strategy must contain enough pieces of each type
  // so the operator can fill the monthly quota every month. Without this
  // explicit math the model just sprinkles a few GBP posts and skips press
  // releases entirely.
  const totalQuota = {
    blogs: monthlyCapacity.blogs * 6,
    gbpPosts: monthlyCapacity.gbpPosts * 6,
    gbpQAs: monthlyCapacity.gbpQAs * 6,
    pressReleases: monthlyCapacity.pressReleases * 6,
  };

  const prompt = `You are an expert SEO content strategist building a 6-month topical authority plan for this business. Your output drives the agency's content workflow — every piece you propose must be specific, scoped, and promotable to a writer without further refinement.

## Client Profile
- **Business:** ${client.name}
- **Website:** ${client.domain || "Not provided"}
- **Location:** ${locationStr}
- **Industry:** ${client.gbpCategory || "Not specified"}
- **Service Tier:** ${client.tier}
- **Monthly Content Capacity:** ${monthlyCapacity.blogs} blogs, ${monthlyCapacity.gbpPosts} GBP posts, ${monthlyCapacity.gbpQAs} GBP Q&As, ${monthlyCapacity.pressReleases} press releases

## Output volume requirements (HARD MINIMUMS)
You MUST generate at least the following totals across the entire 6-month strategy (pillars.pieces + quickWins combined). The operator fills the monthly quota every month from this strategy — under-generating means they can't fill their plan.
- **BLOG_POST:** ${totalQuota.blogs} pieces minimum (${monthlyCapacity.blogs}/month × 6)
- **GBP_POST:** ${totalQuota.gbpPosts} pieces minimum (${monthlyCapacity.gbpPosts}/month × 6)
- **GBP_QA:** ${totalQuota.gbpQAs} pieces minimum (${monthlyCapacity.gbpQAs}/month × 6)
- **PRESS_RELEASE:** ${totalQuota.pressReleases} pieces minimum (${monthlyCapacity.pressReleases}/month × 6)

For each non-zero type, distribute pieces across \`monthIndex\` 1–6 so each month has roughly its monthly capacity available. If a type's quota is 0, generate none of that type.

## Available Keywords (Top ${Math.min(keywords.length, 80)})
${keywords.slice(0, 80).map((kw, i) => {
  const mode = keywordModes.get(kw.keyword.toLowerCase());
  const modeTag = mode === "PAIN_POINT" ? " [PAIN]" : mode === "SERVICE" ? " [SERVICE]" : "";
  return `${i + 1}.${modeTag} "${kw.keyword}" — Vol: ${kw.searchVolume}, Comp: ${kw.competition}%, CPC: $${(kw.cpc || 0).toFixed(2)}`;
}).join("\n")}

## Content type guidance
- **BLOG_POST** — the backbone. Long-form articles targeting specific keywords. Lives inside pillars.
- **GBP_POST** — short Google Business Profile updates (200–400 chars). Promotional, hyperlocal, event/offer/news flavored. Tie to current pillar themes and seasonal hooks. Distribute these mostly into Quick Wins or as supporting pieces inside pillars.
- **GBP_QA** — Q&A entries for the GBP profile. Short, FAQ-style. Each one should answer a real customer question the business gets.
- **PRESS_RELEASE** — newsworthy announcements (new service, milestone, award, partnership, expansion). One per month if the quota allows; tie to the monthlyFocus theme. PR earns links and topical authority — don't skip these when quota > 0.

## Strategy rules

1. **Pillars are topical territories**, not single articles. 4–6 pillars covering the business's full surface area. **If the keyword pool spans multiple distinct themes** (look for [SERVICE] vs [PAIN] tags — they often represent different revenue lines), build pillars across both. A web-design agency that ALSO does CRM automations should get a "Web Design" pillar AND a "Service Business Automation" pillar — don't collapse them.
2. **Tag every piece with a funnel stage**:
   - **TOFU** = top-of-funnel — informational, "how does X work", broad awareness — most [PAIN] keywords land here
   - **MOFU** = middle-of-funnel — comparison, "X vs Y", "best X", buyer-research
   - **BOFU** = bottom-of-funnel — commercial, "hire X near me", "X cost", ready-to-buy — most [SERVICE] keywords land here
3. **Pace difficulty across 6 months.** Month 1 = quick wins (BOFU, low competition). Month 2-3 = MOFU buildouts. Month 4-5 = TOFU pillar pages + thought leadership. Month 6 = quarterly recap + refresh.
4. **Quick wins** = low-competition, high-intent keywords that should be published in month 1 regardless of pillar architecture. Aim for 5–10. Quick wins can be any content type — a hyperlocal GBP_POST or a launch PRESS_RELEASE both qualify.
5. **Be concrete** — every piece needs a unique \`id\`, a publishable \`title\`, a \`keyword\` target, a \`description\` (one sentence outline), \`funnelStage\`, \`monthIndex\` (1–6), and \`pillarSlug\`.

## Output JSON exactly in this structure:

\`\`\`json
{
  "pillars": [
    {
      "slug": "kebab-case-slug",
      "title": "Pillar topic name",
      "description": "Why this pillar wins authority",
      "targetKeyword": "primary keyword the pillar page targets",
      "pieces": [
        {
          "id": "unique-id",
          "type": "BLOG_POST",
          "title": "Specific publishable title",
          "keyword": "target keyword",
          "description": "One-sentence outline",
          "funnelStage": "TOFU",
          "monthIndex": 1,
          "priority": 3,
          "promoted": false
        }
      ]
    }
  ],
  "quickWins": [
    {
      "id": "unique-id",
      "type": "BLOG_POST",
      "title": "Specific publishable title",
      "keyword": "low competition keyword",
      "description": "One-sentence outline",
      "funnelStage": "BOFU",
      "monthIndex": 1,
      "reason": "Why this ranks fast",
      "promoted": false
    }
  ],
  "monthlyFocus": {
    "1": "Theme for month 1",
    "2": "Theme for month 2",
    "3": "Theme for month 3",
    "4": "Theme for month 4",
    "5": "Theme for month 5",
    "6": "Theme for month 6"
  }
}
\`\`\`

Generate 4–6 pillars. **You MUST hit the per-type minimums above** — count pieces by \`type\` before responding. Place BLOG_POSTs primarily inside pillars (5–8 per pillar). GBP_POST, GBP_QA, and PRESS_RELEASE pieces can live inside pillars as supporting content OR in \`quickWins\` — whichever fits the strategic flow. Return ONLY the JSON, no surrounding text.`;

  // Stream NDJSON so Cloudflare (and any other proxy with an idle timeout)
  // sees bytes flowing within the first second. The full Claude call can take
  // 60–180s, which blows past Cloudflare's 100s default response timeout if
  // the route stays silent until completion. We send {"type":"started"}
  // immediately, heartbeat every 15s while Claude works, and finish with
  // either {"type":"done", ...} or {"type":"error", message}.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const send = (obj: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          /* controller already closed */
        }
      };

      send({ type: "started" });
      heartbeat = setInterval(() => send({ type: "heartbeat", at: Date.now() }), 15000);

      try {
        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": claudeKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
            // Output sizing: with a full quota strategy (e.g. 10 blogs × 6 +
            // 4 GBP × 6 + 1 PR × 6 = ~96 pieces × ~150 tokens) we can push
            // past 15K tokens of pure JSON. 24K leaves enough headroom for
            // larger tier quotas without hitting `stop_reason: max_tokens`.
            max_tokens: 24000,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!claudeRes.ok) {
          const errorText = await claudeRes.text();
          throw new Error(`Claude API error: ${claudeRes.status} ${errorText}`);
        }

        const claudeData = await claudeRes.json();
        const rawText: string = claudeData.content?.[0]?.text || "";
        const stopReason = claudeData.stop_reason;

        if (stopReason === "max_tokens") {
          throw new Error(
            "Strategy generation hit the output token limit before Claude finished. " +
              "This usually means the keyword pool is too large — try generating with fewer research sessions."
          );
        }

        // Extract JSON from response. Claude is told to return ONLY JSON but
        // sometimes wraps it in prose, markdown fences, or both. Try in order:
        //   1. Fenced ```json block
        //   2. Fenced ``` block
        //   3. First `{` through last `}` in the text (handles prose wrapping)
        //   4. Raw text
        let mapData;
        let jsonStr = rawText;
        const fenced =
          rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
          rawText.match(/```\s*([\s\S]*?)\s*```/);
        if (fenced) {
          jsonStr = fenced[1];
        } else {
          const firstBrace = rawText.indexOf("{");
          const lastBrace = rawText.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = rawText.slice(firstBrace, lastBrace + 1);
          }
        }

        try {
          mapData = JSON.parse(jsonStr.trim());
        } catch (parseErr) {
          console.warn("[CONTENT-MAP] JSON parse failed.", parseErr);
          throw new Error(
            "Claude returned malformed JSON for the content strategy. " +
              "The existing strategy is preserved — try regenerating again."
          );
        }

        // Normalize: ensure every piece has an id, promoted flag, and funnelStage.
        // Claude usually obeys the schema but we don't trust it absolutely.
        let nextSerial = 1;
        const ensureId = (existing: unknown) =>
          typeof existing === "string" && existing.length > 0
            ? existing
            : `mp_${Date.now().toString(36)}_${nextSerial++}`;

        if (mapData?.pillars && Array.isArray(mapData.pillars)) {
          for (const pillar of mapData.pillars) {
            if (!pillar.slug && pillar.title) {
              pillar.slug = String(pillar.title)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
            }
            if (Array.isArray(pillar.pieces)) {
              for (const p of pillar.pieces) {
                p.id = ensureId(p.id);
                p.promoted = p.promoted === true;
                p.funnelStage = ["TOFU", "MOFU", "BOFU"].includes(p.funnelStage)
                  ? p.funnelStage
                  : "MOFU";
                p.monthIndex = Number.isInteger(p.monthIndex)
                  ? Math.max(1, Math.min(6, p.monthIndex))
                  : 1;
                p.pillarSlug = pillar.slug;
              }
            }
          }
        }
        if (Array.isArray(mapData?.quickWins)) {
          for (const q of mapData.quickWins) {
            q.id = ensureId(q.id);
            q.promoted = q.promoted === true;
            q.funnelStage = ["TOFU", "MOFU", "BOFU"].includes(q.funnelStage)
              ? q.funnelStage
              : "BOFU";
            q.monthIndex = Number.isInteger(q.monthIndex)
              ? Math.max(1, Math.min(6, q.monthIndex))
              : 1;
            q.pillarSlug = "quick-wins";
          }
        }

        const pillarCount = Array.isArray(mapData?.pillars) ? mapData.pillars.length : 0;
        const quickWinCount = Array.isArray(mapData?.quickWins) ? mapData.quickWins.length : 0;
        if (pillarCount === 0 && quickWinCount === 0) {
          throw new Error(
            "Claude returned a strategy with no pillars or quick wins. " +
              "The existing strategy is preserved — try regenerating again."
          );
        }

        send({ type: "progress", stage: "summary" });

        // Generate AI summary
        const summaryPrompt = `Based on this content strategy map, write a 2-3 sentence executive summary for the agency team explaining the core strategy and expected SEO outcomes:

${JSON.stringify(mapData, null, 2)}

Business: ${client.name} in ${locationStr}
Keep it concise and actionable.`;

        let aiSummary: string | null = null;
        try {
          const summaryRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": claudeKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
              max_tokens: 300,
              messages: [{ role: "user", content: summaryPrompt }],
            }),
          });
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            aiSummary = summaryData.content?.[0]?.text || null;
          }
        } catch {
          // Summary is optional
        }

        // Save content map
        const now = new Date();
        const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
        const defaultTitle = body.title || `${quarter} ${now.getFullYear()} Content Strategy`;

        // Regenerate semantics: any prior ContentMap for this client gets
        // deactivated. Only one "active" map at a time — but old maps are
        // preserved (isActive=false) so the agency can compare strategic
        // evolution over months.
        await prisma.contentMap.updateMany({
          where: { clientId, isActive: true },
          data: { isActive: false },
        });

        const contentMap = await prisma.contentMap.create({
          data: {
            clientId,
            title: defaultTitle,
            mapData: JSON.stringify(mapData),
            aiSummary,
            isActive: true,
          },
        });

        send({
          type: "done",
          id: contentMap.id,
          title: contentMap.title,
          mapData,
          aiSummary,
          message: `Content strategy map generated with ${mapData.pillars?.length || 0} pillar topics`,
        });
      } catch (err) {
        console.error("[CONTENT-MAP] Error:", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to generate content map",
        });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      // Tells nginx/Cloudflare-ish proxies not to buffer the response.
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * GET /api/clients/[clientId]/content-map
 * Get all content maps for a client.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" &&
      session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  const maps = await prisma.contentMap.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json(
    maps.map((m) => ({
      ...m,
      mapData: JSON.parse(m.mapData || "{}"),
    }))
  );
}
