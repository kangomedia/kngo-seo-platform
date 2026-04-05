/**
 * Claude AI API Client (Anthropic)
 * Powers topical map generation, content drafting, and content briefs
 */

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

interface ClaudeConfig {
  apiKey: string;
  model?: string;
}

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

async function claudeChat(
  messages: ClaudeMessage[],
  systemPrompt: string,
  config: ClaudeConfig
) {
  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.content[0]?.text || "";
}

// ─── Topical Map Generation ───────────────────────────

export interface TopicalMapParams {
  seedKeyword: string;
  businessName: string;
  businessType: string;
  location?: string;
  blogCount?: number;
  gbpCount?: number;
  prCount?: number;
}

export async function generateTopicalMap(
  params: TopicalMapParams,
  config: ClaudeConfig
): Promise<string> {
  const system = `You are an expert SEO content strategist. Generate topical content maps that are highly relevant, locally targeted, and optimized for search intent. Return your response as valid JSON.`;

  const prompt = `Generate a monthly content plan for:
- Business: ${params.businessName} (${params.businessType})
- Seed keyword: "${params.seedKeyword}"
${params.location ? `- Location: ${params.location}` : ""}
- Blog posts needed: ${params.blogCount || 4}
- Google Business Profile posts needed: ${params.gbpCount || 8}
- Press releases needed: ${params.prCount || 0}

For each piece, provide:
- title: compelling, click-worthy title
- description: 2-3 sentence angle/brief explaining what the piece covers and why it matters
- keyword: primary target keyword
- type: "Blog Post", "GBP Post", or "Press Release"
- searchIntent: "informational", "commercial", "transactional", or "navigational"

Group blog posts into topical clusters. GBP posts should focus on services, offers, events, and local engagement. Press releases should cover newsworthy business updates.

Return as JSON: { "planTitle": "...", "clusters": [{ "name": "...", "pieces": [...] }] }`;

  return claudeChat(
    [{ role: "user", content: prompt }],
    system,
    config
  );
}

// ─── Content Drafting ─────────────────────────────────

export interface ContentDraftParams {
  title: string;
  type: "Blog Post" | "GBP Post" | "Press Release";
  keyword: string;
  businessName: string;
  brief?: string;
  tone?: string;
  wordCount?: number;
}

export async function generateDraft(
  params: ContentDraftParams,
  config: ClaudeConfig
): Promise<string> {
  const system = `You are an expert SEO content writer. Write engaging, well-structured content that naturally incorporates target keywords without keyword stuffing. Use a ${params.tone || "professional yet approachable"} tone.`;

  const wordTarget = params.type === "GBP Post" ? 150 : params.type === "Press Release" ? 600 : params.wordCount || 1500;

  const prompt = `Write a ${params.type} for ${params.businessName}:
- Title: "${params.title}"
- Target keyword: "${params.keyword}"
- Target word count: ~${wordTarget} words
${params.brief ? `- Brief: ${params.brief}` : ""}

${params.type === "Blog Post" ? "Use H2 and H3 subheadings. Include an engaging intro, practical information, and a clear conclusion with a call to action. Format in Markdown." : ""}
${params.type === "GBP Post" ? "Keep it concise, engaging, and action-oriented. Include a clear CTA." : ""}
${params.type === "Press Release" ? "Follow standard press release format with headline, dateline, body paragraphs, boilerplate, and contact info placeholder." : ""}`;

  return claudeChat(
    [{ role: "user", content: prompt }],
    system,
    config
  );
}

// ─── Content Enhancement ──────────────────────────────

export async function enhanceContent(
  content: string,
  keyword: string,
  config: ClaudeConfig
): Promise<string> {
  const system = `You are an SEO content optimization expert. Analyze content and provide specific, actionable suggestions to improve its search performance.`;

  const prompt = `Analyze this content targeting the keyword "${keyword}" and provide:
1. Missing LSI/NLP entities to add
2. Heading structure improvements
3. Internal linking opportunities
4. Content gaps vs. competitors
5. Readability improvements

Content:
${content.substring(0, 3000)}`;

  return claudeChat(
    [{ role: "user", content: prompt }],
    system,
    config
  );
}

export type { ClaudeConfig };
