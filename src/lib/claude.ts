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

// ─── Audit Recommendations ───────────────────────────

export interface AuditPageData {
  url: string;
  title: string | null;
  description: string | null;
  h1Count: number;
  wordCount: number;
  imageCount: number;
  imagesNoAlt: number;
  checks: Record<string, boolean>;
}

export interface AuditRecommendation {
  checkKey: string;
  severity: "critical" | "warning" | "info";
  issue: string;
  currentValue: string | null;
  suggestion: string;
  explanation: string;
}

export async function generateSEORecommendations(
  page: AuditPageData,
  targetKeyword: string | null,
  config: ClaudeConfig
): Promise<AuditRecommendation[]> {
  const failedChecks = Object.entries(page.checks)
    .filter(([, failed]) => failed)
    .map(([key]) => key);

  if (failedChecks.length === 0) return [];

  const system = `You are an expert on-page SEO auditor. Analyze the provided page data and generate specific, actionable recommendations for each failed check. For title and description issues, write ready-to-use replacement text. For image alt issues, describe what kind of alt text should be added. Be specific and practical — the user should be able to copy-paste your suggestions directly into their CMS.

IMPORTANT: Return ONLY valid JSON array, no markdown fencing, no explanation outside the JSON.`;

  const prompt = `Analyze this page and generate fix recommendations:

URL: ${page.url}
Current Title: ${page.title || "(none)"}
Current Meta Description: ${page.description || "(none)"}
H1 Count: ${page.h1Count}
Word Count: ${page.wordCount}
Images: ${page.imageCount} total, ${page.imagesNoAlt} missing alt text
${targetKeyword ? `Target Keyword: "${targetKeyword}"` : ""}

Failed checks: ${JSON.stringify(failedChecks)}

For each failed check, return a JSON array of objects with these fields:
- checkKey: the check identifier (e.g. "no_title")
- severity: "critical" | "warning" | "info"
- issue: human-readable description of the problem
- currentValue: what the page currently has (null if nothing)
- suggestion: the specific replacement text or action to take
- explanation: brief explanation of WHY this fix matters for SEO

For title/description issues, write an optimized replacement incorporating ${targetKeyword ? `the keyword "${targetKeyword}"` : "relevant keywords from the URL/content"}.
For alt text issues, describe what alt tags should include based on the page context.
Classify severity: missing title/description/h1 = critical, too long/short = warning, other = info.

Return only the JSON array.`;

  const raw = await claudeChat(
    [{ role: "user", content: prompt }],
    system,
    config
  );

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error("[CLAUDE] Failed to parse recommendations JSON:", raw.substring(0, 200));
    return [];
  }
}
