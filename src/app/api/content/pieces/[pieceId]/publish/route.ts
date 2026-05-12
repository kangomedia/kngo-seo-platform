import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { loadCredentials, createPost } from "@/lib/wordpress";
import { generateSlug } from "@/lib/slug";

/**
 * Replace every `[anchor](slug)` placeholder in a draft body with either:
 *   - the resolved `[anchor](real-url)` when the slug points to a piece
 *     that's already PUBLISHED with a publishedUrl
 *   - just `anchor` (link stripped) when the target piece doesn't exist
 *     yet — the broken-link risk on the live site outweighs the value of
 *     a non-functional link
 *
 * Returns the rewritten body plus a map of slugs that resolved, so the
 * caller can flip the InternalLink rows to RESOLVED.
 */
async function resolveInternalLinks(
  body: string,
  clientId: string
): Promise<{ rewrittenBody: string; resolvedSlugs: Set<string>; strippedSlugs: Set<string> }> {
  const resolvedSlugs = new Set<string>();
  const strippedSlugs = new Set<string>();

  // First pass: collect every distinct slug referenced. Avoids hitting the
  // DB once per occurrence when the same slug is linked multiple times.
  const slugRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  const distinctSlugs = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = slugRe.exec(body)) !== null) {
    const target = m[2].trim();
    if (/^https?:\/\//i.test(target)) continue;
    if (target.startsWith("#") || target.startsWith("/") || target.startsWith("mailto:") || target.startsWith("tel:")) continue;
    if (target.includes(":") || target.includes(" ")) continue;
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(target)) continue;
    distinctSlugs.add(target.toLowerCase());
  }

  if (distinctSlugs.size === 0) {
    return { rewrittenBody: body, resolvedSlugs, strippedSlugs };
  }

  const targets = await prisma.contentPiece.findMany({
    where: {
      contentPlan: { clientId },
      slug: { in: Array.from(distinctSlugs) },
      status: "PUBLISHED",
      publishedUrl: { not: null },
    },
    select: { slug: true, publishedUrl: true },
  });
  const urlBySlug = new Map<string, string>();
  for (const t of targets) {
    if (t.slug && t.publishedUrl) urlBySlug.set(t.slug, t.publishedUrl);
  }

  // Second pass: rewrite the body using the resolution map. Reset regex.
  const rewrittenBody = body.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (match, anchor, target) => {
      const t = String(target).trim();
      if (/^https?:\/\//i.test(t)) return match;
      if (t.startsWith("#") || t.startsWith("/") || t.startsWith("mailto:") || t.startsWith("tel:")) return match;
      if (t.includes(":") || t.includes(" ")) return match;
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(t)) return match;
      const slug = t.toLowerCase();
      const url = urlBySlug.get(slug);
      if (url) {
        resolvedSlugs.add(slug);
        return `[${anchor}](${url})`;
      }
      strippedSlugs.add(slug);
      return anchor; // strip the link, keep visible text
    }
  );

  return { rewrittenBody, resolvedSlugs, strippedSlugs };
}

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

  // Resolve `[anchor](slug)` internal-link placeholders before publishing.
  // Slugs that map to an already-PUBLISHED piece become real URLs; slugs
  // that don't yet have a target lose the link wrapper (anchor text stays).
  const clientId = client.id;
  const { rewrittenBody, resolvedSlugs, strippedSlugs } = await resolveInternalLinks(piece.body, clientId);

  // Make sure this piece has a slug — required so any future drafts that
  // try to link to it can resolve. Use the existing slug if set, otherwise
  // generate one from the title now.
  const publishSlug = piece.slug || generateSlug(piece.title, piece.keyword);

  try {
    const post = await createPost(creds, {
      title: piece.title,
      content: rewrittenBody,
      excerpt: piece.metaDescription ?? piece.description ?? undefined,
      status: targetStatus,
      slug: publishSlug,
    });

    await prisma.contentPiece.update({
      where: { id: pieceId },
      data: {
        status: "PUBLISHED",
        publishedUrl: post.link,
        publishedAt: new Date(),
        slug: publishSlug,
        // Persist the link-resolved body so future edits and previews show
        // the live version, not the placeholder version.
        body: rewrittenBody,
      },
    });

    // Update this piece's OUTBOUND InternalLink rows for the slugs we just
    // resolved (the rest remain PENDING for future resolution).
    if (resolvedSlugs.size > 0) {
      const targetPieces = await prisma.contentPiece.findMany({
        where: {
          contentPlan: { clientId },
          slug: { in: Array.from(resolvedSlugs) },
        },
        select: { id: true, slug: true },
      });
      const idBySlug = new Map<string, string>();
      for (const t of targetPieces) if (t.slug) idBySlug.set(t.slug, t.id);
      for (const slug of resolvedSlugs) {
        const toPieceId = idBySlug.get(slug);
        if (!toPieceId) continue;
        await prisma.internalLink.updateMany({
          where: { fromPieceId: pieceId, plannedSlug: slug },
          data: { status: "RESOLVED", toPieceId, resolvedAt: new Date() },
        });
      }
    }

    // Now that THIS piece is published with its real URL, walk every
    // PENDING InternalLink that points to its slug (across the client's
    // entire library) and mark them RESOLVED. This sets up the data for
    // a future enhancement (D??): mass-update those source posts in WP so
    // the live links actually work. For now, we just record the resolution.
    const inboundCount = await prisma.internalLink.count({
      where: { plannedSlug: publishSlug, status: "PENDING" },
    });
    if (inboundCount > 0) {
      await prisma.internalLink.updateMany({
        where: { plannedSlug: publishSlug, status: "PENDING" },
        data: { status: "RESOLVED", toPieceId: pieceId, resolvedAt: new Date() },
      });
    }

    return NextResponse.json({
      ok: true,
      wpPostId: post.id,
      url: post.link,
      wpStatus: post.status,
      slug: publishSlug,
      internalLinks: {
        resolved: Array.from(resolvedSlugs),
        stripped: Array.from(strippedSlugs),
        inboundResolved: inboundCount,
      },
    });
  } catch (err) {
    console.error("[WP PUBLISH] Failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed" },
      { status: 502 }
    );
  }
}
