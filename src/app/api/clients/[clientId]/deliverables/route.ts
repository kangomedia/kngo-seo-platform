import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  const deliverables = await prisma.deliverable.findMany({
    where: { clientId },
    orderBy: [{ year: "desc" }, { month: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(deliverables);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const body = await request.json();

  // Update a specific deliverable
  if (body.deliverableId) {
    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.currentCount !== undefined) updateData.currentCount = body.currentCount;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status === "COMPLETED") updateData.completedAt = new Date();

    const deliverable = await prisma.deliverable.update({
      where: { id: body.deliverableId },
      data: updateData,
    });

    return NextResponse.json(deliverable);
  }

  return NextResponse.json({ error: "deliverableId required" }, { status: 400 });
}
