"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

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

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  // Try env key first, then agency settings
  let apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const settings = await prisma.agencySettings.findUnique({
      where: { id: "default" },
    });
    apiKey = settings?.claudeApiKey || undefined;
  }

  if (!apiKey) {
    throw new Error("Claude API key not configured. Set it in Settings or .env");
  }

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "";
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

  const userPrompt = `Write a ${typeLabel} for the following business and topic:

**Business:** ${client.name}
**Website:** ${client.domain || "N/A"}
**Content Title:** ${piece.title}
**Primary Target Keyword:** ${piece.keyword || "general"}
**Content Brief/Angle:** ${piece.description || "No specific brief provided"}
**Seed Topic:** ${piece.contentPlan.seedKeyword || "N/A"}

Write the complete content now. Make it publication-ready.`;

  // Update status to WRITING
  await prisma.contentPiece.update({
    where: { id: contentPieceId },
    data: { status: "WRITING" },
  });

  try {
    const body = await callClaude(systemPrompt, userPrompt);

    // Save the generated body and update status
    await prisma.contentPiece.update({
      where: { id: contentPieceId },
      data: { body, status: "CLIENT_REVIEW" },
    });

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
