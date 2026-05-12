"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { generateSlug, extractInternalLinkPlaceholders } from "@/lib/slug";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

/**
 * Produce a snapshot of the client's *published* content library, ready
 * to embed in the draft prompt so Claude can insert real internal links.
 * Only includes pieces with both a slug and a published URL, so links
 * resolve cleanly at publish time. Capped at 30 entries to keep prompt
 * tokens reasonable.
 */
async function getPublishedLibrary(clientId: string) {
  const pieces = await prisma.contentPiece.findMany({
    where: {
      contentPlan: { clientId },
      status: "PUBLISHED",
      slug: { not: null },
      publishedUrl: { not: null },
    },
    select: {
      slug: true,
      title: true,
      keyword: true,
      description: true,
      type: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });
  return pieces;
}

/**
 * Second Claude call that takes a finished draft body and produces the
 * distribution assets (meta description + per-platform social posts).
 * Kept separate from the body call so we don't risk breaking the existing
 * body-generation prompt — and so we can backfill meta+social for already-
 * drafted pieces later via a "regenerate distribution" action.
 */
/**
 * Public wrapper for `generateDistributionAssets` used by the agency edit
 * modal's "Suggest from this draft" button. Looks up the piece, validates
 * agency auth, runs the same second Claude call we run at draft time, and
 * returns the suggestions WITHOUT saving — the operator confirms before
 * the values land in the DB. Saves are still routed through PATCH.
 */
export async function suggestDistributionAssets(contentPieceId: string): Promise<{
  metaDescription: string | null;
  socialPosts: { twitter: string; linkedin: string; facebook: string; instagram: string } | null;
}> {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    throw new Error("Unauthorized");
  }
  const piece = await prisma.contentPiece.findUnique({
    where: { id: contentPieceId },
    include: { contentPlan: { include: { client: true } } },
  });
  if (!piece) throw new Error("Content piece not found");
  if (!piece.body) {
    throw new Error("Generate or paste a draft body first — distribution assets are written from the finished post.");
  }
  return generateDistributionAssets({
    title: piece.title,
    keyword: piece.keyword,
    body: piece.body,
    type: piece.type,
    businessName: piece.contentPlan.client.name,
    domain: piece.contentPlan.client.domain,
  });
}

async function generateDistributionAssets(args: {
  title: string;
  keyword: string | null;
  body: string;
  type: string;
  businessName: string;
  domain: string | null;
}): Promise<{
  metaDescription: string | null;
  socialPosts: { twitter: string; linkedin: string; facebook: string; instagram: string } | null;
}> {
  const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!claudeKey) return { metaDescription: null, socialPosts: null };

  const prompt = `You are writing the distribution assets for a piece of content the agency just drafted. Output JSON only — no surrounding prose, no markdown fences.

## Content context
- **Business:** ${args.businessName}
- **Website:** ${args.domain || "N/A"}
- **Title:** ${args.title}
- **Target keyword:** ${args.keyword || "n/a"}
- **Type:** ${args.type}

## Draft body (markdown)
${args.body.slice(0, 8000)}${args.body.length > 8000 ? "\n\n[…truncated for prompt length…]" : ""}

## Required output — JSON exactly in this shape

{
  "metaDescription": "150-160 char SEO meta description. Must include the target keyword naturally. End on a verb that prompts action. No clickbait, no quotation marks, no emoji.",
  "socialPosts": {
    "twitter":   "Under 240 chars. One-line hook that makes the click obvious. End with a clear value proposition, not a question. NO hashtags unless they're brand-relevant.",
    "linkedin":  "600-800 chars. Professional but not stiff. Lead with the most surprising insight from the body, then 2-3 takeaways in short paragraph blocks (newlines between them). End with an open-ended question that prompts comments.",
    "facebook":  "400-600 chars. Conversational, first-person agency voice. Tells a 1-2 sentence story or scenario from the draft. Ends with a question or invitation.",
    "instagram": "Caption 1-2 paragraphs (~800 chars). Punchy first line that stops the scroll. Followed by 2-3 key points. End with 8-12 highly-relevant hashtags on their own lines — local + niche, no generic #marketing #seo bullshit."
  }
}

## Rules
- DO NOT include the published URL — the operator's social tool will append it on paste.
- DO NOT use any of these terms: TOFU, MOFU, BOFU, GBP, SERP, "topical authority", "keyword clusters".
- Match the voice of the body — if the body is technical, stay technical; if conversational, stay conversational.
- Return ONLY the JSON object. No \`\`\`json fences. No commentary.`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return { metaDescription: null, socialPosts: null };
    const data = await res.json();
    const raw: string = data?.content?.[0]?.text || "";
    // Extract JSON — handle possible fence wrapping defensively.
    let jsonStr = raw.trim();
    const fenced = jsonStr.match(/```json\s*([\s\S]*?)\s*```/) || jsonStr.match(/```\s*([\s\S]*?)\s*```/);
    if (fenced) jsonStr = fenced[1];
    if (!jsonStr.startsWith("{")) {
      const first = jsonStr.indexOf("{");
      const last = jsonStr.lastIndexOf("}");
      if (first !== -1 && last > first) jsonStr = jsonStr.slice(first, last + 1);
    }
    const parsed = JSON.parse(jsonStr);
    return {
      metaDescription: typeof parsed.metaDescription === "string" ? parsed.metaDescription.trim() : null,
      socialPosts:
        parsed.socialPosts &&
        typeof parsed.socialPosts === "object" &&
        typeof parsed.socialPosts.twitter === "string"
          ? {
              twitter: String(parsed.socialPosts.twitter || "").trim(),
              linkedin: String(parsed.socialPosts.linkedin || "").trim(),
              facebook: String(parsed.socialPosts.facebook || "").trim(),
              instagram: String(parsed.socialPosts.instagram || "").trim(),
            }
          : null,
    };
  } catch (err) {
    console.warn("[DISTRIBUTION-ASSETS] generation failed:", err);
    return { metaDescription: null, socialPosts: null };
  }
}

/**
 * After a draft body is saved, sync the InternalLink rows for this piece
 * to match the placeholders currently in the body. Drops rows that no
 * longer have a matching placeholder; inserts rows for new placeholders.
 * Idempotent — safe to call after every body change.
 */
export async function syncInternalLinks(pieceId: string, body: string, clientId: string) {
  const placeholders = extractInternalLinkPlaceholders(body);
  const wanted = new Map<string, { anchor: string; slug: string }>();
  for (const p of placeholders) {
    // Dedupe on slug — if Claude inserts the same slug twice with different
    // anchor text, we only track one row.
    wanted.set(p.slug, p);
  }

  const existing = await prisma.internalLink.findMany({
    where: { fromPieceId: pieceId },
  });

  // Delete any rows whose plannedSlug isn't in the current body.
  const toDelete = existing.filter((e) => !wanted.has(e.plannedSlug));
  if (toDelete.length > 0) {
    await prisma.internalLink.deleteMany({
      where: { id: { in: toDelete.map((d) => d.id) } },
    });
  }

  // For each placeholder not yet tracked, create the row. Resolve toPieceId
  // immediately if the target piece already exists with that slug.
  const existingSlugs = new Set(existing.map((e) => e.plannedSlug));
  for (const [slug, { anchor }] of wanted.entries()) {
    if (existingSlugs.has(slug)) continue;
    const target = await prisma.contentPiece.findFirst({
      where: {
        contentPlan: { clientId },
        slug,
      },
      select: { id: true, status: true, publishedUrl: true },
    });
    await prisma.internalLink.create({
      data: {
        fromPieceId: pieceId,
        plannedSlug: slug,
        anchorText: anchor,
        toPieceId: target?.id ?? null,
        status:
          target && target.status === "PUBLISHED" && target.publishedUrl
            ? "RESOLVED"
            : "PENDING",
        resolvedAt: target && target.status === "PUBLISHED" ? new Date() : null,
      },
    });
  }
}

interface TopicMapResult {
  pillarTopic: string;
  blogPosts: Array<{
    title: string;
    targetKeyword: string;
    description: string;
    type: "BLOG_POST" | "GBP_POST" | "PRESS_RELEASE";
  }>;
  gbpPosts: Array<{
    title: string;
    targetKeyword: string;
    description: string;
    type: "GBP_POST";
  }>;
}

// Network errors that warrant a retry — connection-level transients only.
const RETRYABLE_NET_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

function isRetryableNetworkError(err: unknown): { retry: boolean; detail: string } {
  const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
  const code = cause?.code;
  const detail = cause?.message || cause?.code || (err instanceof Error ? err.message : String(err));
  return { retry: !!code && RETRYABLE_NET_CODES.has(code), detail };
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  // 90s is generous enough for a 4096-token Sonnet response without leaving
  // the user staring at a spinner for the system socket-timeout default.
  const requestTimeoutMs = 90_000;
  const maxAttempts = 3;
  const body = JSON.stringify({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  let lastDetail = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (err) {
      const { retry, detail } = isRetryableNetworkError(err);
      // AbortSignal.timeout produces a TimeoutError that's also worth retrying.
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      lastDetail = detail;
      if ((retry || isTimeout) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250)));
        continue;
      }
      throw new Error(`Anthropic request failed (model=${model}, attempt=${attempt}/${maxAttempts}): ${detail}`);
    }

    // Retry transient server errors (429, 5xx). Auth / bad-request errors
    // (4xx other than 429) won't fix themselves — fail fast and surface them.
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const transient = response.status === 429 || response.status >= 500;
      if (transient && attempt < maxAttempts) {
        lastDetail = `${response.status} ${response.statusText} ${errText}`.trim();
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250)));
        continue;
      }
      throw new Error(`Claude API error: ${response.status} ${response.statusText} ${errText}`.trim());
    }

    const data = await response.json();
    return data.content[0]?.text || "";
  }
  throw new Error(`Anthropic request failed after ${maxAttempts} attempts: ${lastDetail}`);
}

export async function generateTopicalMap(
  clientId: string,
  seedKeyword: string,
  blogCount: number = 4,
  gbpCount: number = 8
): Promise<TopicMapResult> {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    throw new Error("Unauthorized");
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found");

  const systemPrompt = `You are an expert local SEO strategist specializing in content planning for small businesses. You create topical content maps that establish topical authority around a seed keyword.

Your output must be valid JSON that matches this exact schema:
{
  "pillarTopic": "string - the central pillar topic",
  "blogPosts": [{ "title": "string", "targetKeyword": "string", "description": "string - 1-2 sentence brief explaining the angle", "type": "BLOG_POST" }],
  "gbpPosts": [{ "title": "string", "targetKeyword": "string", "description": "string - 1-2 sentence brief", "type": "GBP_POST" }]
}

Rules:
- Blog posts should cover informational, commercial, and comparison intents
- GBP posts should be promotions, tips, seasonal content, and social proof
- Descriptions should explain the content angle and why it matters for SEO
- Target keywords should be realistic long-tail variations
- Content should be geographically targeted to the client's service area
- Output ONLY the JSON object, no markdown or code fences`;

  const userPrompt = `Create a topical content map for ${client.name} (${client.domain}).

Seed keyword: "${seedKeyword}"
Blog posts needed: ${blogCount}
GBP posts needed: ${gbpCount}

The business is a local service provider. Create content that builds topical authority around the seed keyword while targeting realistic search queries their customers would use.`;

  const response = await callClaude(systemPrompt, userPrompt);

  try {
    // Strip any accidental code fences
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as TopicMapResult;
  } catch {
    throw new Error("Failed to parse Claude response. Try again.");
  }
}

export async function saveTopicalMapAsContentPlan(
  clientId: string,
  month: number,
  year: number,
  seedKeyword: string,
  map: TopicMapResult
) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    throw new Error("Unauthorized");
  }

  // Create or update content plan
  const plan = await prisma.contentPlan.upsert({
    where: {
      clientId_month_year: { clientId, month, year },
    },
    update: {
      seedKeyword,
      title: `${new Date(year, month - 1).toLocaleString("default", { month: "long" })} ${year} Content Plan`,
    },
    create: {
      clientId,
      month,
      year,
      seedKeyword,
      title: `${new Date(year, month - 1).toLocaleString("default", { month: "long" })} ${year} Content Plan`,
    },
  });

  // Delete existing pieces for this plan (fresh import)
  await prisma.contentPiece.deleteMany({
    where: { contentPlanId: plan.id },
  });

  // Insert all pieces
  const allPieces = [
    ...map.blogPosts.map((p, i) => ({
      contentPlanId: plan.id,
      type: "BLOG_POST" as const,
      title: p.title,
      description: p.description,
      keyword: p.targetKeyword,
      status: "PLANNED" as const,
      sortOrder: i,
    })),
    ...map.gbpPosts.map((p, i) => ({
      contentPlanId: plan.id,
      type: "GBP_POST" as const,
      title: p.title,
      description: p.description,
      keyword: p.targetKeyword,
      status: "PLANNED" as const,
      sortOrder: map.blogPosts.length + i,
    })),
  ];

  await prisma.contentPiece.createMany({ data: allPieces });

  revalidatePath(`/agency/clients/${clientId}/content`);
  return plan;
}

export async function generateContentBody(contentPieceId: string): Promise<string> {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    throw new Error("Unauthorized");
  }
  return generateContentBodyInternal(contentPieceId);
}

/**
 * Auth-free version of `generateContentBody`. Only call this from trusted
 * server code AFTER you have done your own auth check. Used by the batch
 * draft generator, which checks auth once at the request boundary and then
 * calls this for each piece in the background — by which point the original
 * request's session cookie context is no longer available to `auth()`.
 */
export async function generateContentBodyInternal(contentPieceId: string): Promise<string> {
  const piece = await prisma.contentPiece.findUnique({
    where: { id: contentPieceId },
    include: { contentPlan: { include: { client: true } } },
  });

  if (!piece) throw new Error("Content piece not found");

  const client = piece.contentPlan.client;

  const typeLabel =
    piece.type === "BLOG_POST"
      ? "blog post"
      : piece.type === "GBP_POST"
      ? "Google Business Profile post"
      : "press release";

  // Type-specific SEO writing instructions
  const typeInstructions: Record<string, string> = {
    BLOG_POST: `## Blog Post SEO Writing Framework

**Length:** 1,200–2,000 words (comprehensive enough to satisfy search intent)

**Structure Requirements:**
- **Title (H1):** Include the primary keyword naturally. Use power words for CTR (Ultimate, Complete, Expert, etc.)
- **Meta Description:** Write a compelling 150-160 character meta description as a comment at the top
- **Introduction (first 100 words):** Hook the reader, clearly state the problem/topic, include the primary keyword in the first paragraph, and preview what they'll learn
- **Body with H2/H3 headings:** Each H2 should target a semantic variation or subtopic. Use H3s for supporting detail
- **Keyword Placement:** Primary keyword in H1, first paragraph, one H2, conclusion, and 2-3 times naturally in body. Use semantic variations and LSI keywords throughout
- **Internal Link Opportunities:** Add placeholders like [INTERNAL LINK: related topic] where internal links should go
- **E-E-A-T Signals:** Include specific data points, statistics, expert opinions, and actionable advice that demonstrates first-hand experience and expertise
- **NLP Entity Optimization:** Mention related entities (brands, locations, tools, industry terms) that Google associates with the topic
- **FAQ Section:** Include 3-5 FAQs using "People Also Ask" style questions as H3s with concise answers (schema-ready)
- **CTA:** End with a clear, compelling call to action specific to the business
- **Local SEO:** Naturally weave in the business's service area, city, and neighborhood references`,

    GBP_POST: `## Google Business Profile Post SEO Framework

**Length:** 150–300 words (concise, scannable, action-oriented)

**Structure Requirements:**
- **Opening Hook:** Start with an attention-grabbing statement or question (emoji optional for engagement)
- **Value Proposition:** 2-3 sentences explaining the offer, tip, update, or seasonal content
- **Local Signals:** Mention the city/area naturally — Google uses this for local ranking signals
- **Call to Action:** End with a specific CTA (Call now, Book online, Visit us, Learn more)
- **Keywords:** Include the target keyword once naturally. Use 1-2 related local terms
- **Tone:** Friendly, professional, and direct. Write as the business speaking to their community
- **DO NOT** use markdown headings — GBP posts are plain text with line breaks`,

    PRESS_RELEASE: `## Press Release SEO Framework

**Length:** 400–800 words

**Structure Requirements:**
- **Headline:** Newsworthy, keyword-rich headline (not clickbait)
- **Dateline:** [CITY, State] — [Date]
- **Lead Paragraph:** WHO, WHAT, WHEN, WHERE, WHY in the first paragraph. Include primary keyword
- **Body Paragraphs:** Expand on the news with supporting details, context, and impact
- **Quote:** Include 1-2 quotes from the business owner or relevant stakeholder (use realistic placeholder names)
- **Boilerplate:** End with an "About [Company]" section with the business description, location, and contact info
- **Keywords:** Primary keyword in headline, lead paragraph, one subhead, and boilerplate
- **Links:** Include placeholder [LINK: company website] where appropriate
- **Tone:** Professional, third-person, newsworthy. Not promotional — informational`,
  };

  const systemPrompt = `You are a senior SEO content strategist and writer with 10+ years of experience in search engine optimization and content marketing. You write content that ranks on Google while being genuinely helpful to readers.

Your content philosophy:
- Search intent satisfaction is the #1 ranking factor — every piece must fully answer what the searcher is looking for
- E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) signals must be woven naturally into the content
- Keyword optimization should be invisible to readers — never sacrifice readability for keyword density
- Every piece must provide unique value that competitors don't offer
- Content should be scannable with clear hierarchy, short paragraphs, and strategic formatting

${typeInstructions[piece.type] || typeInstructions.BLOG_POST}

**Critical Rules:**
- NEVER use filler phrases like "In today's world" or "In this article, we will discuss"
- NEVER stuff keywords — use natural language and semantic variations
- ALWAYS write content that a human expert in the field would be proud to publish
- ALWAYS include specific, actionable information — not vague generalizations
- Format output in Markdown (except GBP posts which should be plain text with line breaks)`;

  // Build a manifest of already-published pieces so Claude can insert
  // real internal links wherever a related piece exists. Each entry is
  // referenced by `slug` only — the publish flow swaps the slug for the
  // real URL at publish time. If the manifest is empty (new client) we
  // skip this section entirely.
  const library = await getPublishedLibrary(client.id);
  const internalLinkSection = library.length === 0
    ? ""
    : `

## Internal linking manifest

When topically relevant, add internal links to these already-published pieces. Use the format \`[anchor text](slug)\` — slug only, NOT the full URL. The platform resolves slugs to real URLs at publish time.

DO NOT force links — only link when the related piece genuinely helps the reader. 2–4 internal links is typical for a 1,500-word post; 0 is fine if nothing fits.

| Slug | Title | Target keyword | Type |
|---|---|---|---|
${library
  .map((p) => `| \`${p.slug}\` | ${p.title.replace(/\|/g, "\\|")} | ${p.keyword || "—"} | ${p.type} |`)
  .join("\n")}`;

  const userPrompt = `Write a ${typeLabel} for the following business and topic:

**Business:** ${client.name}
**Website:** ${client.domain || "N/A"}
**Content Title:** ${piece.title}
**Primary Target Keyword:** ${piece.keyword || "general"}
**Content Brief/Angle:** ${piece.description || "No specific brief provided"}
**Seed Topic:** ${piece.contentPlan.seedKeyword || "N/A"}
${internalLinkSection}

Write the complete content now. Make it publication-ready.`;

  // Update status to WRITING
  await prisma.contentPiece.update({
    where: { id: contentPieceId },
    data: { status: "WRITING" },
  });

  try {
    const body = await callClaude(systemPrompt, userPrompt);

    // Generate distribution assets (meta description + social posts) from
    // the finished body in a second, smaller call. Returns nulls if it
    // fails — body generation is the primary deliverable, distribution
    // assets are a bonus we can regenerate later.
    const distribution = await generateDistributionAssets({
      title: piece.title,
      keyword: piece.keyword,
      body,
      type: piece.type,
      businessName: client.name,
      domain: client.domain,
    });

    // Generate a planned slug from the title. Operator can override at
    // publish time, but having one from day 1 means future drafts can
    // link to this piece even before it's published.
    const plannedSlug = piece.slug || generateSlug(piece.title, piece.keyword);

    // Draft is ready for AGENCY review (not yet sent to the client). The
    // explicit "Send Drafts for Review" action transitions DRAFT_REVIEW →
    // CLIENT_REVIEW and dispatches the email.
    await prisma.contentPiece.update({
      where: { id: contentPieceId },
      data: {
        body,
        status: "DRAFT_REVIEW",
        slug: plannedSlug,
        metaDescription: distribution.metaDescription,
        socialPosts: distribution.socialPosts
          ? JSON.stringify(distribution.socialPosts)
          : null,
      },
    });

    // Mirror the inline `[anchor](slug)` placeholders into the
    // InternalLink table so we can show the agency what's linked where,
    // and resolve placeholders → real URLs at publish time.
    await syncInternalLinks(contentPieceId, body, client.id);

    revalidatePath("/agency");
    return body;
  } catch (err) {
    // Reset status on failure
    await prisma.contentPiece.update({
      where: { id: contentPieceId },
      data: { status: "PLANNED" },
    });
    throw err;
  }
}
