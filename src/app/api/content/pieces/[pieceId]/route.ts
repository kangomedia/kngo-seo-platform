import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * PATCH /api/content/pieces/[pieceId]
 * Update a content piece's status, dates, published URL, etc.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" &&
      session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pieceId } = await params;
  const body = await request.json();

  const allowedFields = [
    "status",
    "priority",
    "dueDate",
    "scheduledPublishDate",
    "publishedUrl",
    "publishedAt",
    "title",
    "description",
    "keyword",
  ];

  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // Handle date fields
      if (["dueDate", "scheduledPublishDate", "publishedAt"].includes(field)) {
        updateData[field] = body[field] ? new Date(body[field]) : null;
      } else {
        updateData[field] = body[field];
      }
    }
  }

  // Handle revision loop: if moving from DRAFT_REVIEW back to WRITING, increment revisionCount
  if (body.status === "WRITING") {
    const current = await prisma.contentPiece.findUnique({
      where: { id: pieceId },
      select: { status: true },
    });
    if (current && (current.status === "DRAFT_REVIEW" || current.status === "CLIENT_REVIEW")) {
      updateData.revisionCount = { increment: 1 };
    }
  }

  // If marking as PUBLISHED, set publishedAt if not already set
  if (body.status === "PUBLISHED" && !body.publishedAt) {
    updateData.publishedAt = new Date();
  }

  try {
    const updated = await prisma.contentPiece.update({
      where: { id: pieceId },
      data: updateData,
      include: {
        contentPlan: {
          include: {
            client: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update content piece:", error);
    return NextResponse.json(
      { error: "Failed to update content piece" },
      { status: 500 }
    );
  }
}
