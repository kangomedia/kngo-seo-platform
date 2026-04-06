import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** POST: Mark all drafted content pieces as CLIENT_REVIEW and return the client portal URL */
export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { clientId, contentPlanId } = body;

  if (!clientId || !contentPlanId) {
    return NextResponse.json(
      { error: "clientId and contentPlanId are required" },
      { status: 400 }
    );
  }

  // Get the client's access token
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { accessToken: true, name: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Find all content pieces with a body that are still in PLANNED or WRITING status
  const updated = await prisma.contentPiece.updateMany({
    where: {
      contentPlanId,
      body: { not: null },
      status: { in: ["PLANNED", "WRITING", "CLIENT_REVIEW"] },
    },
    data: {
      status: "CLIENT_REVIEW",
    },
  });

  return NextResponse.json({
    updatedCount: updated.count,
    accessToken: client.accessToken,
    clientName: client.name,
    message: `${updated.count} content piece(s) sent for approval`,
  });
}
