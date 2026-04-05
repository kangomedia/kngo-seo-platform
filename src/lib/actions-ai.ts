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
    piece.type === "BLOG_POST" ? "blog post" : piece.type === "GBP_POST" ? "Google Business Profile post" : "press release";

  const systemPrompt = `You are an expert SEO content writer. Write engaging, locally-optimized content for a ${typeLabel}.

Rules:
- Write in a professional yet conversational tone
- Include the target keyword naturally (don't stuff)
- For blog posts: 800-1200 words, include H2/H3 headings, a strong intro, and CTA
- For GBP posts: 150-300 words, punchy and action-oriented with a CTA
- For press releases: 400-600 words, newsworthy angle, quote from business owner
- Include local context (city/neighborhood mentions where natural)
- Format in Markdown`;

  const userPrompt = `Write a ${typeLabel} for ${client.name} (${client.domain}).

Title: ${piece.title}
Target Keyword: ${piece.keyword || "general"}
Brief: ${piece.description || "No specific brief provided"}
`;

  const body = await callClaude(systemPrompt, userPrompt);

  // Save the generated body
  await prisma.contentPiece.update({
    where: { id: contentPieceId },
    data: { body },
  });

  revalidatePath("/agency");
  return body;
}
