import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** POST: Set ContentPlan.planStatus to PENDING_APPROVAL and return the client portal URL */
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

  // Update plan status to PENDING_APPROVAL
  await prisma.contentPlan.update({
    where: { id: contentPlanId },
    data: { planStatus: "PENDING_APPROVAL" },
  });

  return NextResponse.json({
    accessToken: client.accessToken,
    clientName: client.name,
    message: "Content plan sent for client approval",
  });
}
