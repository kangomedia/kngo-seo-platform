import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" &&
      session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    clientId,
    seedKeyword,
    blogCount = 4,
    gbpCount = 8,
    pressReleaseCount = 0,
  } = body;

  if (!clientId || !seedKeyword) {
    return NextResponse.json(
      { error: "clientId and seedKeyword are required" },
      { status: 400 }
    );
  }

  // Get Claude API key from settings
  const settings = await prisma.agencySettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.claudeApiKey) {
    return NextResponse.json(
      {
        error:
          "Claude API key not configured. Go to Settings to add your API key.",
      },
      { status: 400 }
    );
  }

  // Get client info for context
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true, domain: true, tier: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Build Claude prompt
  const now = new Date();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthLabel = `${monthNames[currentMonth - 1]} ${currentYear}`;

  const prompt = `You are an SEO content strategist. Generate a content plan for a client.

Client: ${client.name}
Website: ${client.domain || "N/A"}
Seed Keyword: ${seedKeyword}
Month: ${monthLabel}

Generate the following content pieces:
- ${blogCount} blog posts (type: BLOG_POST)
- ${gbpCount} Google Business Profile posts (type: GBP_POST)
- ${pressReleaseCount > 0 ? `${pressReleaseCount} press releases (type: PRESS_RELEASE)` : ""}

For each piece, provide:
1. title - compelling, SEO-optimized title
2. description - 1-2 sentence brief/angle for the content
3. keyword - the specific target keyword for this piece (related to "${seedKeyword}")
4. type - BLOG_POST, GBP_POST, or PRESS_RELEASE

Blog posts should be comprehensive pillar/cluster content targeting long-tail variations.
GBP posts should be short, local-focused updates with calls to action.
Press releases should be newsworthy announcements related to the industry.

Respond ONLY with a valid JSON array. No markdown, no explanation. Example format:
[
  {"title": "...", "description": "...", "keyword": "...", "type": "BLOG_POST"},
  {"title": "...", "description": "...", "keyword": "...", "type": "GBP_POST"}
]`;

  try {
    // Call Claude API
    const claudeResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.claudeApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      }
    );

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("[CONTENT] Claude API error:", errText);
      return NextResponse.json(
        { error: "Claude API error. Check your API key in Settings." },
        { status: 502 }
      );
    }

    const claudeData = await claudeResponse.json();
    const textContent = claudeData.content?.[0]?.text || "";

    // Parse JSON from Claude's response
    let pieces: Array<{
      title: string;
      description: string;
      keyword: string;
      type: string;
    }>;

    try {
      // Claude sometimes wraps JSON in markdown code blocks
      const jsonMatch =
        textContent.match(/\[[\s\S]*\]/) || textContent.match(/```json\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[0].replace(/```json|```/g, "").trim() : textContent;
      pieces = JSON.parse(jsonStr);
    } catch {
      console.error("[CONTENT] Failed to parse Claude response:", textContent);
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Create ContentPlan + ContentPieces in database
    const plan = await prisma.contentPlan.create({
      data: {
        clientId,
        month: currentMonth,
        year: currentYear,
        title: `${monthLabel} Content Plan`,
        seedKeyword,
        pieces: {
          create: pieces.map((p, i) => ({
            type: p.type as "BLOG_POST" | "GBP_POST" | "PRESS_RELEASE",
            title: p.title,
            description: p.description || "",
            keyword: p.keyword || seedKeyword,
            sortOrder: i,
            status: "PLANNED",
          })),
        },
      },
      include: {
        pieces: {
          orderBy: { sortOrder: "asc" },
          include: { approval: true },
        },
      },
    });

    // Auto-create deliverables from the generated plan
    const blogPieces = pieces.filter((p) => p.type === "BLOG_POST").length;
    const gbpPieces = pieces.filter((p) => p.type === "GBP_POST").length;
    const prPieces = pieces.filter((p) => p.type === "PRESS_RELEASE").length;

    const deliverablesToCreate = [];
    if (blogPieces > 0) {
      deliverablesToCreate.push({
        clientId,
        month: currentMonth,
        year: currentYear,
        name: "Blog Posts",
        targetCount: blogPieces,
        currentCount: 0,
        status: "PENDING" as const,
      });
    }
    if (gbpPieces > 0) {
      deliverablesToCreate.push({
        clientId,
        month: currentMonth,
        year: currentYear,
        name: "GBP Posts",
        targetCount: gbpPieces,
        currentCount: 0,
        status: "PENDING" as const,
      });
    }
    if (prPieces > 0) {
      deliverablesToCreate.push({
        clientId,
        month: currentMonth,
        year: currentYear,
        name: "Press Releases",
        targetCount: prPieces,
        currentCount: 0,
        status: "PENDING" as const,
      });
    }

    if (deliverablesToCreate.length > 0) {
      await prisma.deliverable.createMany({ data: deliverablesToCreate });
    }

    return NextResponse.json({
      plan,
      message: `Generated ${pieces.length} content pieces and ${deliverablesToCreate.length} deliverables`,
    });
  } catch (err) {
    console.error("[CONTENT] Generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate content plan" },
      { status: 500 }
    );
  }
}
