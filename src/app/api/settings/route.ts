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

  // Mask sensitive values — only send whether they're configured
  return NextResponse.json({
    agencyName: settings.agencyName,
    logoUrl: settings.logoUrl,
    dataforseoLogin: settings.dataforseoLogin || "",
    dataforseoPwd: settings.dataforseoPwd ? "••••••••" : "",
    claudeApiKey: settings.claudeApiKey ? "sk-ant-•••••••" : "",
    ghlApiKey: settings.ghlApiKey ? "••••••••" : "",
    ghlLocationId: settings.ghlLocationId || "",
    // Connection status booleans
    hasDataForSEO: !!(settings.dataforseoLogin && settings.dataforseoPwd),
    hasClaude: !!settings.claudeApiKey,
    hasGHL: !!settings.ghlApiKey,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Only update fields that were actually sent (not masked placeholders)
  const updateData: Record<string, string | null> = {};

  if (body.agencyName !== undefined) updateData.agencyName = body.agencyName;
  if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
  if (body.dataforseoLogin !== undefined) updateData.dataforseoLogin = body.dataforseoLogin;
  if (body.dataforseoPwd && !body.dataforseoPwd.includes("•")) updateData.dataforseoPwd = body.dataforseoPwd;
  if (body.claudeApiKey && !body.claudeApiKey.includes("•")) updateData.claudeApiKey = body.claudeApiKey;
  if (body.ghlApiKey && !body.ghlApiKey.includes("•")) updateData.ghlApiKey = body.ghlApiKey;
  if (body.ghlLocationId !== undefined) updateData.ghlLocationId = body.ghlLocationId;

  const settings = await prisma.agencySettings.upsert({
    where: { id: "default" },
    update: updateData,
    create: { id: "default", ...updateData },
  });

  return NextResponse.json({
    agencyName: settings.agencyName,
    logoUrl: settings.logoUrl,
    hasDataForSEO: !!(settings.dataforseoLogin && settings.dataforseoPwd),
    hasClaude: !!settings.claudeApiKey,
    hasGHL: !!settings.ghlApiKey,
    message: "Settings saved successfully",
  });
}
