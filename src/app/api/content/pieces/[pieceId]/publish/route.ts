import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { loadCredentials, createPost } from "@/lib/wordpress";

/**
 * POST /api/content/pieces/[pieceId]/publish
 *
 * Body (optional): { status?: "draft" | "publish" }
 *
 * Publishes the content piece to the client's WordPress site via the REST API.
 * Defaults to status "draft" so an editor can review on-site before going live.
 * On success, persists the WP post URL and marks the piece PUBLISHED.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pieceId } = await params;
  const body = await req.json().catch(() => ({}));
  const targetStatus: "draft" | "publish" = body?.status === "publish" ? "publish" : "draft";

  const piece = await prisma.contentPiece.findUnique({
    where: { id: pieceId },
    include: { contentPlan: { include: { client: true } } },
  });

  if (!piece) {
    return NextResponse.json({ error: "Content piece not found" }, { status: 404 });
  }
  if (piece.status !== "APPROVED" && piece.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: `Piece must be APPROVED before publishing (current status: ${piece.status}).` },
      { status: 400 }
    );
  }
  if (!piece.body) {
    return NextResponse.json({ error: "Piece has no body content to publish." }, { status: 400 });
  }

  const client = piece.contentPlan.client;
  const creds = loadCredentials(client);
  if (!creds) {
    return NextResponse.json(
      { error: "WordPress is not configured for this client. Add credentials in client settings." },
      { status: 400 }
    );
  }

  try {
    const post = await createPost(creds, {
      title: piece.title,
      content: piece.body,
      excerpt: piece.description ?? undefined,
      status: targetStatus,
    });

    await prisma.contentPiece.update({
      where: { id: pieceId },
      data: {
        status: "PUBLISHED",
        publishedUrl: post.link,
        publishedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      wpPostId: post.id,
      url: post.link,
      wpStatus: post.status,
    });
  } catch (err) {
    console.error("[WP PUBLISH] Failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed" },
      { status: 502 }
    );
  }
}
