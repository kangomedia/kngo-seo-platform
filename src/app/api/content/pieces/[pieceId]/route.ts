import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { pieceId } = await params;
    const piece = await prisma.contentPiece.findUnique({ where: { id: pieceId } });
    if (!piece) {
      return NextResponse.json({ error: "Piece not found" }, { status: 404 });
    }
    await prisma.contentPiece.delete({ where: { id: pieceId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting content piece:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
