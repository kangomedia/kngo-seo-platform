import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { syncInternalLinks } from "@/lib/actions-ai";
import { generateSlug } from "@/lib/slug";

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

/**
 * PATCH: agency-side edits to a ContentPiece. Used by the manual draft
 * editor and by the "mark annotations resolved" action when the agency has
 * addressed a client's inline feedback.
 *
 * Body shape:
 *   { body?: string, title?: string, status?: ContentStatus, resolveAnnotationIds?: string[] }
 *
 * Only AGENCY_ADMIN can hit this. Status transitions are NOT validated here
 * — callers should pass the right next state ("DRAFT_REVIEW" when posting
 * an edit that should go back through the agency review queue, "APPROVED"
 * if the edit shouldn't change status, etc.).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { pieceId } = await params;
    const body = await request.json().catch(() => ({}));
    const piece = await prisma.contentPiece.findUnique({
      where: { id: pieceId },
      include: { contentPlan: { select: { clientId: true } } },
    });
    if (!piece) {
      return NextResponse.json({ error: "Piece not found" }, { status: 404 });
    }

    const updateData: {
      body?: string;
      title?: string;
      slug?: string | null;
      metaDescription?: string | null;
      socialPosts?: string | null;
      publishedUrl?: string | null;
      publishedAt?: Date | null;
      status?: "PLANNED" | "WRITING" | "DRAFT_REVIEW" | "CLIENT_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED";
      revisionCount?: { increment: number };
    } = {};
    if (typeof body.body === "string") updateData.body = body.body;
    if (typeof body.title === "string" && body.title.trim().length > 0) {
      updateData.title = body.title.trim();
    }
    if (typeof body.slug === "string") {
      // Sanitize slug: lowercase alphanumerics + hyphens. Empty string
      // clears the slug.
      const clean = body.slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
      updateData.slug = clean || null;
    }
    if (typeof body.metaDescription === "string") {
      updateData.metaDescription = body.metaDescription.trim() || null;
    }
    if (body.socialPosts !== undefined) {
      // Accept either a stringified JSON blob or an object (we always
      // store stringified). Falsy → null clears the field.
      if (body.socialPosts === null || body.socialPosts === "") {
        updateData.socialPosts = null;
      } else if (typeof body.socialPosts === "string") {
        updateData.socialPosts = body.socialPosts;
      } else if (typeof body.socialPosts === "object") {
        updateData.socialPosts = JSON.stringify(body.socialPosts);
      }
    }
    if (typeof body.publishedUrl === "string") {
      updateData.publishedUrl = body.publishedUrl.trim() || null;
    }
    if (typeof body.publishedAt === "string" && body.publishedAt) {
      const parsed = new Date(body.publishedAt);
      if (!Number.isNaN(parsed.getTime())) updateData.publishedAt = parsed;
    }
    if (typeof body.status === "string") {
      const allowed = ["PLANNED", "WRITING", "DRAFT_REVIEW", "CLIENT_REVIEW", "APPROVED", "REJECTED", "PUBLISHED"] as const;
      if ((allowed as readonly string[]).includes(body.status)) {
        updateData.status = body.status as typeof allowed[number];
      }
    }
    // If the agency edited the body, bump the revision counter so the
    // monthly report can show "X revisions this month."
    if (typeof body.body === "string") {
      updateData.revisionCount = { increment: 1 };
    }

    // Mark specific annotations resolved, if requested. This is best-effort:
    // if the IDs don't belong to this piece they're silently skipped, since
    // the FK + scoped update query handles that.
    if (Array.isArray(body.resolveAnnotationIds) && body.resolveAnnotationIds.length > 0) {
      await prisma.pieceAnnotation.updateMany({
        where: {
          id: { in: body.resolveAnnotationIds },
          contentPieceId: pieceId,
        },
        data: { resolved: true, resolvedAt: new Date() },
      });
    }

    // If this update is the manual "Mark Published" path, make sure the
    // piece has a slug (so future drafts can link to it) and resolve any
    // inbound PENDING InternalLinks that reference this slug.
    if (updateData.status === "PUBLISHED") {
      if (!updateData.slug && !piece.slug) {
        updateData.slug = generateSlug(piece.title, piece.keyword);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.contentPiece.update({
        where: { id: pieceId },
        data: updateData,
      });
    }

    // If the body changed, the set of `[anchor](slug)` placeholders inside
    // it may have changed too — re-sync the InternalLink rows so the
    // publish-time resolver works against current state.
    if (typeof body.body === "string") {
      await syncInternalLinks(pieceId, body.body, piece.contentPlan.clientId);
    }

    // On manual publish, mark any inbound PENDING links pointing to this
    // piece's slug as RESOLVED.
    if (updateData.status === "PUBLISHED") {
      const finalSlug = updateData.slug ?? piece.slug;
      if (finalSlug) {
        await prisma.internalLink.updateMany({
          where: { plannedSlug: finalSlug, status: "PENDING" },
          data: { status: "RESOLVED", toPieceId: pieceId, resolvedAt: new Date() },
        });
      }
    }

    const updated = await prisma.contentPiece.findUnique({
      where: { id: pieceId },
      include: {
        approval: true,
        annotations: { orderBy: { createdAt: "asc" } },
        linksFrom: { orderBy: { createdAt: "asc" } },
      },
    });
    return NextResponse.json({ piece: updated });
  } catch (error) {
    console.error("Error updating content piece:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
