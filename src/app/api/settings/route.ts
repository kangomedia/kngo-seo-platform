import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let settings = await prisma.agencySettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.agencySettings.create({
      data: { id: "default" },
    });
  }

  // Check env vars first, then DB
  const envDataforseoLogin = process.env.DATAFORSEO_LOGIN;
  const envDataforseoPwd = process.env.DATAFORSEO_PASSWORD;
  const envClaudeKey = process.env.ANTHROPIC_API_KEY;
  const envGhlKey = process.env.GHL_API_KEY;

  const hasDataForSEOEnv = !!(envDataforseoLogin && envDataforseoPwd);
  const hasClaudeEnv = !!envClaudeKey;
  const hasGHLEnv = !!envGhlKey;

  const hasDataForSEODb = !!(settings.dataforseoLogin && settings.dataforseoPwd);
  const hasClaudeDb = !!settings.claudeApiKey;
  const hasGHLDb = !!settings.ghlApiKey;

  return NextResponse.json({
    agencyName: settings.agencyName,
    logoUrl: settings.logoUrl,
    // DataForSEO: show env source or DB value
    dataforseoLogin: hasDataForSEOEnv ? "(set via environment)" : settings.dataforseoLogin || "",
    dataforseoPwd: hasDataForSEOEnv ? "(set via environment)" : settings.dataforseoPwd ? "••••••••" : "",
    // Claude: show env source or DB value
    claudeApiKey: hasClaudeEnv ? "(set via environment)" : settings.claudeApiKey ? "sk-ant-•••••••" : "",
    // GHL
    ghlApiKey: hasGHLEnv ? "(set via environment)" : settings.ghlApiKey ? "••••••••" : "",
    ghlLocationId: settings.ghlLocationId || "",
    // Connection status — true if EITHER env or DB is configured
    hasDataForSEO: hasDataForSEOEnv || hasDataForSEODb,
    hasClaude: hasClaudeEnv || hasClaudeDb,
    hasGHL: hasGHLEnv || hasGHLDb,
    // Source indicators for the UI
    dataforseoSource: hasDataForSEOEnv ? "env" : hasDataForSEODb ? "db" : null,
    claudeSource: hasClaudeEnv ? "env" : hasClaudeDb ? "db" : null,
    ghlSource: hasGHLEnv ? "env" : hasGHLDb ? "db" : null,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Only update fields that were actually sent (not masked/env placeholders)
  const updateData: Record<string, string | null> = {};

  if (body.agencyName !== undefined) updateData.agencyName = body.agencyName;
  if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
  if (body.dataforseoLogin !== undefined && !body.dataforseoLogin.includes("(set via")) updateData.dataforseoLogin = body.dataforseoLogin;
  if (body.dataforseoPwd && !body.dataforseoPwd.includes("•") && !body.dataforseoPwd.includes("(set via")) updateData.dataforseoPwd = body.dataforseoPwd;
  if (body.claudeApiKey && !body.claudeApiKey.includes("•") && !body.claudeApiKey.includes("(set via")) updateData.claudeApiKey = body.claudeApiKey;
  if (body.ghlApiKey && !body.ghlApiKey.includes("•") && !body.ghlApiKey.includes("(set via")) updateData.ghlApiKey = body.ghlApiKey;
  if (body.ghlLocationId !== undefined) updateData.ghlLocationId = body.ghlLocationId;

  const settings = await prisma.agencySettings.upsert({
    where: { id: "default" },
    update: updateData,
    create: { id: "default", ...updateData },
  });

  // Re-check env vars for response
  const hasDataForSEO = !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) ||
    !!(settings.dataforseoLogin && settings.dataforseoPwd);
  const hasClaude = !!process.env.ANTHROPIC_API_KEY || !!settings.claudeApiKey;
  const hasGHL = !!process.env.GHL_API_KEY || !!settings.ghlApiKey;

  return NextResponse.json({
    agencyName: settings.agencyName,
    logoUrl: settings.logoUrl,
    hasDataForSEO,
    hasClaude,
    hasGHL,
    message: "Settings saved successfully",
  });
}
