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
  const { clientId, seedKeyword } = body;

  if (!clientId || !seedKeyword) {
    return NextResponse.json(
      { error: "clientId and seedKeyword are required" },
      { status: 400 }
    );
  }

  // Get Claude API key: env vars first, DB settings as fallback
  let apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const settings = await prisma.agencySettings.findUnique({
      where: { id: "default" },
    });
    apiKey = settings?.claudeApiKey || undefined;
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Claude API key not configured. Set ANTHROPIC_API_KEY environment variable or add it in Settings.",
      },
      { status: 400 }
    );
  }

  // Get client info for context — include monthly capacity fields
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      name: true,
      domain: true,
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

  const targetBlogCount = body.blogCount ?? client.monthlyBlogs;
  const targetGbpCount = body.gbpCount ?? client.monthlyGbpPosts;
  const targetGbpQACount = body.gbpQACount ?? client.monthlyGbpQAs;
  const targetPrCount = body.pressReleaseCount ?? client.monthlyPressReleases;
  const planId = body.planId;

  // Generate 2x the quota ONLY for new plans (client will review sequentially until quota is met).
  // When appending to an existing plan, generate exactly what was requested.
  const multiplier = planId ? 1 : 2;
  const blogCount = targetBlogCount * multiplier;
  const gbpCount = targetGbpCount * multiplier;
  const gbpQACount = targetGbpQACount * multiplier;
  const pressReleaseCount = targetPrCount * multiplier;

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
${gbpQACount > 0 ? `- ${gbpQACount} Google Business Profile Q&As (type: GBP_QA)` : ""}
${pressReleaseCount > 0 ? `- ${pressReleaseCount} press releases (type: PRESS_RELEASE)` : ""}

For each piece, provide:
1. title - compelling, SEO-optimized title
2. description - 1-2 sentence brief/angle for the content
3. keyword - the specific target keyword for this piece (related to "${seedKeyword}")
4. type - BLOG_POST, GBP_POST, GBP_QA, or PRESS_RELEASE

Blog posts should be comprehensive pillar/cluster content targeting long-tail variations.
GBP posts should be short, local-focused updates with calls to action.
GBP Q&As should be common customer questions with authoritative answers for the Google Business Profile.
Press releases should be newsworthy announcements related to the industry.

CRITICAL INSTRUCTIONS:
1. You MUST generate EXACTLY ${blogCount + gbpCount + gbpQACount + pressReleaseCount} pieces in total.
2. IMPORTANT: Generate the pieces in this exact order:
   - First ${blogCount} items MUST have "type": "BLOG_POST"
   - Next ${gbpCount} items MUST have "type": "GBP_POST"
   - Next ${gbpQACount} items MUST have "type": "GBP_QA"
   - Final ${pressReleaseCount} items MUST have "type": "PRESS_RELEASE"
3. NEVER label a Q&A or a Press Release as a BLOG_POST. Strictly use the exact 'type' strings provided.

Respond ONLY with a valid JSON array. No markdown, no explanation. Example format:
[
  {"title": "...", "description": "...", "keyword": "...", "type": "BLOG_POST"},
  {"title": "...", "description": "...", "keyword": "...", "type": "GBP_POST"},
  {"title": "...", "description": "...", "keyword": "...", "type": "GBP_QA"}
]`;

  try {
    // Call Claude API
    const claudeResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
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
    // Mark the first N of each type as primary, the rest as reserves
    const typeCounters: Record<string, number> = {};
    const targetCounts: Record<string, number> = {
      BLOG_POST: targetBlogCount,
      GBP_POST: targetGbpCount,
      GBP_QA: targetGbpQACount,
      PRESS_RELEASE: targetPrCount,
    };

    let plan;
    if (planId) {
      // Append to existing plan
      const existingPlan = await prisma.contentPlan.findUnique({
        where: { id: planId },
        include: { pieces: true },
      });
      
      if (!existingPlan) {
        return NextResponse.json({ error: "Content plan not found" }, { status: 404 });
      }

      // Count existing pieces to accurately determine isReserve status for new ones
      for (const piece of existingPlan.pieces) {
        typeCounters[piece.type] = (typeCounters[piece.type] || 0) + 1;
      }

      // Build a definitive array of expected types in exact order
      const expectedTypes: ("BLOG_POST" | "GBP_POST" | "GBP_QA" | "PRESS_RELEASE")[] = [];
      for (let i = 0; i < blogCount; i++) expectedTypes.push("BLOG_POST");
      for (let i = 0; i < gbpCount; i++) expectedTypes.push("GBP_POST");
      for (let i = 0; i < gbpQACount; i++) expectedTypes.push("GBP_QA");
      for (let i = 0; i < pressReleaseCount; i++) expectedTypes.push("PRESS_RELEASE");

      plan = await prisma.contentPlan.update({
        where: { id: planId },
        data: {
          pieces: {
            create: pieces.map((p, i) => {
              // Override AI type with strictly guaranteed expected type if available
              const type = expectedTypes[i] || (p.type as "BLOG_POST" | "GBP_POST" | "GBP_QA" | "PRESS_RELEASE");
              typeCounters[type] = (typeCounters[type] || 0) + 1;
              return {
                type,
                title: p.title,
                description: p.description || "",
                keyword: p.keyword || seedKeyword,
                sortOrder: existingPlan.pieces.length + i,
                status: "PLANNED" as const,
                isReserve: false,
              };
            }),
          },
        },
        include: {
          pieces: {
            orderBy: { sortOrder: "asc" },
            include: { approval: true },
          },
        },
      });
    } else {
      // Build a definitive array of expected types in exact order
      const expectedTypes: ("BLOG_POST" | "GBP_POST" | "GBP_QA" | "PRESS_RELEASE")[] = [];
      for (let i = 0; i < blogCount; i++) expectedTypes.push("BLOG_POST");
      for (let i = 0; i < gbpCount; i++) expectedTypes.push("GBP_POST");
      for (let i = 0; i < gbpQACount; i++) expectedTypes.push("GBP_QA");
      for (let i = 0; i < pressReleaseCount; i++) expectedTypes.push("PRESS_RELEASE");

      // Create new plan
      plan = await prisma.contentPlan.create({
        data: {
          clientId,
          month: currentMonth,
          year: currentYear,
          title: `${monthLabel} Content Plan`,
          seedKeyword,
          pieces: {
            create: pieces.map((p, i) => {
              // Override AI type with strictly guaranteed expected type if available
              const type = expectedTypes[i] || (p.type as "BLOG_POST" | "GBP_POST" | "GBP_QA" | "PRESS_RELEASE");
              typeCounters[type] = (typeCounters[type] || 0) + 1;
              return {
                type,
                title: p.title,
                description: p.description || "",
                keyword: p.keyword || seedKeyword,
                sortOrder: i,
                status: "PLANNED" as const,
                isReserve: false,
              };
            }),
          },
        },
        include: {
          pieces: {
            orderBy: { sortOrder: "asc" },
            include: { approval: true },
          },
        },
      });
    }

    // Auto-create deliverables from the generated plan (use TARGET counts, not generated counts)
    const existingDeliverables = await prisma.deliverable.findMany({
      where: { clientId, month: currentMonth, year: currentYear }
    });
    const existingNames = new Set(existingDeliverables.map(d => d.name));

    const deliverablesToCreate = [];
    if (targetBlogCount > 0 && !existingNames.has("Blog Posts")) {
      deliverablesToCreate.push({
        clientId,
        month: currentMonth,
        year: currentYear,
        name: "Blog Posts",
        targetCount: targetBlogCount,
        currentCount: 0,
        status: "PENDING" as const,
      });
    }
    if (targetGbpCount > 0 && !existingNames.has("GBP Posts")) {
      deliverablesToCreate.push({
        clientId,
        month: currentMonth,
        year: currentYear,
        name: "GBP Posts",
        targetCount: targetGbpCount,
        currentCount: 0,
        status: "PENDING" as const,
      });
    }
    if (targetGbpQACount > 0 && !existingNames.has("GBP Q&As")) {
      deliverablesToCreate.push({
        clientId,
        month: currentMonth,
        year: currentYear,
        name: "GBP Q&As",
        targetCount: targetGbpQACount,
        currentCount: 0,
        status: "PENDING" as const,
      });
    }
    if (targetPrCount > 0 && !existingNames.has("Press Releases")) {
      deliverablesToCreate.push({
        clientId,
        month: currentMonth,
        year: currentYear,
        name: "Press Releases",
        targetCount: targetPrCount,
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
