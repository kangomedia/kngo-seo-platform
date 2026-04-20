import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

  // Get keywords either from a research session or directly
  let keywords: Array<{ keyword: string; searchVolume: number; competition: number; cpc: number }> = [];

  if (body.researchId) {
    const research = await prisma.keywordResearch.findUnique({
      where: { id: body.researchId },
    });
    if (research) {
      keywords = JSON.parse(research.results || "[]");
    }
  } else if (body.keywords && Array.isArray(body.keywords)) {
    keywords = body.keywords;
  }

  if (keywords.length === 0) {
    return NextResponse.json(
      { error: "No keywords provided. Pass researchId or keywords array." },
      { status: 400 }
    );
  }

  // Get Claude key
  const settings = await prisma.agencySettings.findUnique({
    where: { id: "default" },
  });
  const claudeKey = process.env.CLAUDE_API_KEY || settings?.claudeApiKey;

  if (!claudeKey) {
    return NextResponse.json(
      { error: "Claude API key not configured" },
      { status: 500 }
    );
  }

  const locationStr = client.city && client.state
    ? `${client.city}, ${client.state}`
    : "United States";

  const monthlyCapacity = {
    blogs: client.monthlyBlogs,
    gbpPosts: client.monthlyGbpPosts,
    gbpQAs: client.monthlyGbpQAs,
    pressReleases: client.monthlyPressReleases,
  };

  const prompt = `You are an expert SEO content strategist. Generate a comprehensive content strategy map for this business.

## Client Profile
- **Business:** ${client.name}
- **Website:** ${client.domain || "Not provided"}
- **Location:** ${locationStr}
- **Industry:** ${client.gbpCategory || "Not specified"}
- **Service Tier:** ${client.tier}
- **Monthly Content Capacity:** ${monthlyCapacity.blogs} blogs, ${monthlyCapacity.gbpPosts} GBP posts, ${monthlyCapacity.gbpQAs} GBP Q&As, ${monthlyCapacity.pressReleases} press releases

## Available Keywords (Top ${Math.min(keywords.length, 50)})
${keywords.slice(0, 50).map((kw, i) => `${i + 1}. "${kw.keyword}" — Vol: ${kw.searchVolume}, Competition: ${kw.competition}%`).join("\n")}

## Generate a Content Strategy Map in the following JSON structure:

\`\`\`json
{
  "pillars": [
    {
      "topic": "Pillar topic name",
      "description": "Why this pillar matters for SEO authority",
      "targetKeyword": "primary keyword",
      "contentPlan": [
        {
          "type": "BLOG_POST",
          "title": "Content title",
          "keyword": "target keyword",
          "description": "Brief content outline",
          "priority": 1-5,
          "month": 1
        }
      ]
    }
  ],
  "quickWins": [
    {
      "keyword": "low competition keyword",
      "suggestedType": "BLOG_POST|GBP_POST|GBP_QA",
      "title": "Quick content idea",
      "reason": "Why this is a quick win"
    }
  ],
  "monthlyPlan": {
    "month1": { "focus": "Theme", "pieces": ["Title 1", "Title 2"] },
    "month2": { "focus": "Theme", "pieces": ["Title 1", "Title 2"] },
    "month3": { "focus": "Theme", "pieces": ["Title 1", "Title 2"] }
  }
}
\`\`\`

Important: Generate exactly 3-5 pillars with 3-4 content pieces each. Each piece should have a specific keyword target. Plan content across 3 months respecting the monthly capacity limits. Return ONLY the JSON, no surrounding text.`;

  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errorText = await claudeRes.text();
      throw new Error(`Claude API error: ${claudeRes.status} ${errorText}`);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || "";

    // Extract JSON from response (Claude may wrap in code blocks)
    let mapData;
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
                      rawText.match(/```\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawText;

    try {
      mapData = JSON.parse(jsonStr.trim());
    } catch {
      // If JSON parsing fails, store the raw text
      mapData = { raw: rawText, error: "Could not parse structured map" };
    }

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
          model: "claude-sonnet-4-20250514",
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

    const contentMap = await prisma.contentMap.create({
      data: {
        clientId,
        title: defaultTitle,
        mapData: JSON.stringify(mapData),
        aiSummary,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: contentMap.id,
      title: contentMap.title,
      mapData,
      aiSummary,
      message: `Content strategy map generated with ${mapData.pillars?.length || 0} pillar topics`,
    });
  } catch (err) {
    console.error("[CONTENT-MAP] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate content map" },
      { status: 500 }
    );
  }
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
