import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Agency settings API.
 *
 * Credentials (DataForSEO, Claude, GHL) are read exclusively from
 * environment variables. The DB columns for them are deprecated and
 * will be ignored. Use Coolify env-var management to set them.
 */

function envStatus() {
  return {
    hasDataForSEO: !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),
    hasClaude: !!process.env.ANTHROPIC_API_KEY,
    hasGHL: !!process.env.GHL_API_KEY,
  };
}

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

  return NextResponse.json({
    agencyName: settings.agencyName,
    logoUrl: settings.logoUrl,
    ...envStatus(),
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updateData: Record<string, string | null> = {};

  if (body.agencyName !== undefined) updateData.agencyName = body.agencyName;
  if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;

  const settings = await prisma.agencySettings.upsert({
    where: { id: "default" },
    update: updateData,
    create: { id: "default", ...updateData },
  });

  return NextResponse.json({
    agencyName: settings.agencyName,
    logoUrl: settings.logoUrl,
    ...envStatus(),
    message: "Settings saved successfully",
  });
}
