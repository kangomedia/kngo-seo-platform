import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/content/pieces/[pieceId]/restore
 *
 * Admin-only. Undoes a prior client decision (rejected or save_for_later) by
 * deleting the ContentApproval row and resetting the piece status to PLANNED,
 * so the piece re-enters the active review queue. Used when a client emails
 * saying they changed their mind and the agency needs to put the piece back.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pieceId } = await params;

  const piece = await prisma.contentPiece.findUnique({ where: { id: pieceId } });
  if (!piece) {
    return NextResponse.json({ error: "Content piece not found" }, { status: 404 });
  }

  await prisma.contentApproval.deleteMany({ where: { contentPieceId: pieceId } });
  await prisma.contentPiece.update({
    where: { id: pieceId },
    data: { status: "PLANNED" },
  });

  return NextResponse.json({ success: true });
}
