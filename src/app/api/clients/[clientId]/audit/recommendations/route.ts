import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateSEORecommendations, type AuditPageData } from "@/lib/claude";
import { getRealFailedChecks, filterToRealFailures } from "@/lib/audit-checks";

async function getClaudeApiKey(): Promise<string> {
  let apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const settings = await prisma.agencySettings.findUnique({ where: { id: "default" } });
    apiKey = settings?.claudeApiKey || undefined;
  }
  if (!apiKey) throw new Error("Claude API key not configured");
  return apiKey;
}

// POST — Generate AI recommendations for a specific audit page
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const { pageId, targetKeyword } = await request.json();

  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  // Verify the page belongs to this client
  const page = await prisma.siteAuditPage.findFirst({
    where: { id: pageId },
    include: { audit: true },
  });

  if (!page || page.audit.clientId !== clientId) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const checks: Record<string, boolean> = page.checks ? JSON.parse(page.checks) : {};
  const failedChecks = getRealFailedChecks(checks);
  if (failedChecks.length === 0) {
    return NextResponse.json({ recommendations: [], message: "No issues to fix" });
  }

  try {
    const apiKey = await getClaudeApiKey();

    const pageData: AuditPageData = {
      url: page.url,
      title: page.title,
      description: page.description,
      h1Count: page.h1Count,
      wordCount: page.wordCount,
      imageCount: page.imageCount,
      imagesNoAlt: page.imagesNoAlt,
      checks: filterToRealFailures(checks),
    };

    const recommendations = await generateSEORecommendations(
      pageData,
      targetKeyword || null,
      { apiKey }
    );

    // Store recommendations on the page
    await prisma.siteAuditPage.update({
      where: { id: pageId },
      data: { recommendations: JSON.stringify(recommendations) },
    });

    // Create/update AuditIssue records for each recommendation
    for (const rec of recommendations) {
      await prisma.auditIssue.upsert({
        where: {
          id: `${pageId}_${rec.checkKey}`, // deterministic ID
        },
        create: {
          id: `${pageId}_${rec.checkKey}`,
          pageId,
          checkKey: rec.checkKey,
          severity: rec.severity,
          currentValue: rec.currentValue,
          suggestion: rec.suggestion,
          status: "OPEN",
        },
        update: {
          severity: rec.severity,
          currentValue: rec.currentValue,
          suggestion: rec.suggestion,
          // Don't reset status if already marked fixed
        },
      });
    }

    return NextResponse.json({ recommendations, count: recommendations.length });
  } catch (err) {
    console.error("[AUDIT RECS] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
