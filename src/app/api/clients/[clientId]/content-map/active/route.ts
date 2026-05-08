// Returns the most recently created active ContentMap for a client.
// Used by the Strategy tab in the Content Hub and the client portal roadmap.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
  const map = await prisma.contentMap.findFirst({
    where: { clientId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!map) {
    return NextResponse.json({ map: null });
  }

  let mapData;
  try {
    mapData = JSON.parse(map.mapData);
  } catch {
    mapData = null;
  }

  return NextResponse.json({
    map: {
      id: map.id,
      title: map.title,
      isActive: map.isActive,
      createdAt: map.createdAt,
      updatedAt: map.updatedAt,
      aiSummary: map.aiSummary,
      mapData,
    },
  });
}
