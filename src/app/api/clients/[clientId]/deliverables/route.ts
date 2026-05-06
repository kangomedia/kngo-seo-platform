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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const body = await request.json();

  if (!body.name || !body.targetCount) {
    return NextResponse.json(
      { error: "name and targetCount are required" },
      { status: 400 }
    );
  }

  const now = new Date();
  const deliverable = await prisma.deliverable.create({
    data: {
      clientId,
      name: body.name,
      targetCount: parseInt(body.targetCount, 10),
      currentCount: 0,
      month: body.month || now.getMonth() + 1,
      year: body.year || now.getFullYear(),
      status: "PENDING",
    },
  });

  return NextResponse.json(deliverable);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  
  try {
    const url = new URL(request.url);
    const deliverableId = url.searchParams.get("id");
    
    if (deliverableId) {
      // Delete specific deliverable
      await prisma.deliverable.delete({
        where: { id: deliverableId }
      });
      return NextResponse.json({ success: true });
    } else {
      // Delete all duplicates for this client (cleanup utility)
      const allDeliverables = await prisma.deliverable.findMany({
        where: { clientId },
        orderBy: { createdAt: 'asc' }
      });
      
      const seen = new Set();
      const toDelete = [];
      
      for (const d of allDeliverables) {
        const key = `${d.month}-${d.year}-${d.name}`;
        if (seen.has(key)) {
          toDelete.push(d.id);
        } else {
          seen.add(key);
        }
      }
      
      if (toDelete.length > 0) {
        await prisma.deliverable.deleteMany({
          where: { id: { in: toDelete } }
        });
      }
      
      return NextResponse.json({ success: true, deleted: toDelete.length });
    }
  } catch (error) {
    console.error("Failed to delete deliverable:", error);
    return NextResponse.json({ error: "Failed to delete deliverable" }, { status: 500 });
  }
}
