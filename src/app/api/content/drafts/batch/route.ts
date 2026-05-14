// POST /api/content/drafts/batch
//   Body: { clientId: string, pieceIds?: string[] }
//   - If pieceIds is omitted, batches every PLANNED piece for the client
//     that has no body yet. If provided, restricts the batch to that set.
//   - Marks every selected piece as WRITING immediately, then fires off a
//     background worker pool that calls generateContentBodyInternal with
//     concurrency 3. The HTTP response returns within ~50ms — the worker
//     pool continues running in the Node process after the response is
//     sent (fine for self-hosted Coolify; would not work on serverless).
//   - On per-piece failure, generateContentBodyInternal resets that piece
//     to PLANNED so the operator can retry just the failures next time.
//
// GET /api/content/drafts/batch/status?clientId=<id>
//   Returns { writing, pending, drafted } counts for the client so the
//   UI can poll while a batch is running. When `writing` hits 0, the
//   batch is done.

import { NextResponse } from "next/server";
import { z } from "zod";
import { generateContentBodyInternal } from "@/lib/actions-ai";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validateBody } from "@/lib/validate";

const CONCURRENCY = 3;

/**
 * Body schema for `POST /api/content/drafts/batch`.
 *
 * Sibling to `POST /api/content/draft` (single piece). Both routes operate
 * on `contentPieceId` strings — the batch variant just takes an array. Kept
 * in lockstep deliberately: a future field added here should be added there
 * too. See `DraftPostSchema` in ../draft/route.ts.
 *
 * `pieceIds` is optional — when omitted, the route batches ALL eligible
 * pieces for the client. Required to be non-empty when present so callers
 * sending `pieceIds: []` get a clear 400 instead of "nothing happened."
 */
const DraftsBatchSchema = z.object({
  clientId: z.string().min(1),
  pieceIds: z.array(z.string().min(1)).min(1).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validated = await validateBody(request, DraftsBatchSchema);
  if (validated instanceof NextResponse) return validated;
  const { clientId, pieceIds: explicitIds } = validated;

  // Find eligible pieces. Matches the same `isDraftablePiece` filter the
  // Drafts tab uses to render "awaiting draft":
  //   - body is null (no draft yet)
  //   - status is NOT WRITING (already in progress by another worker)
  //   - status is NOT REJECTED (operator killed it)
  //   - AND it qualifies for drafting: either status ∈ {APPROVED,
  //     DRAFT_REVIEW, CLIENT_REVIEW}, or the client's approval outcome is
  //     "approved" / "request_edits"
  //   - AND the approval outcome isn't "rejected" or "save_for_later"
  //
  // We pull a broader candidate set with `include: { approval }` and
  // filter in JS — Prisma's relation filters with the OR / NOT
  // combinations needed for parity get hard to read.
  const explicitFilter =
    Array.isArray(explicitIds) && explicitIds.length > 0
      ? { id: { in: explicitIds } }
      : {};
  const candidates = await prisma.contentPiece.findMany({
    where: {
      contentPlan: { clientId },
      body: null,
      status: { notIn: ["WRITING", "REJECTED"] },
      ...explicitFilter,
    },
    include: { approval: true },
  });

  const eligible = candidates.filter((p) => {
    const outcome = p.approval?.outcome;
    if (outcome === "rejected" || outcome === "save_for_later") return false;
    const draftable =
      p.status === "APPROVED" ||
      p.status === "DRAFT_REVIEW" ||
      p.status === "CLIENT_REVIEW" ||
      outcome === "approved" ||
      outcome === "request_edits";
    return draftable;
  });

  if (eligible.length === 0) {
    return NextResponse.json({
      started: 0,
      message: "Nothing to generate — every awaiting-draft piece is already covered or has been rejected.",
    });
  }

  const pieceIds = eligible.map((p) => p.id);

  // Flip all selected pieces to WRITING up front so the next status poll
  // immediately reflects "X pieces generating" — the user shouldn't see a
  // gap between clicking the button and the progress display moving.
  await prisma.contentPiece.updateMany({
    where: { id: { in: pieceIds } },
    data: { status: "WRITING" },
  });

  // Fire-and-forget background worker pool. `void` is intentional: we don't
  // await this. Node keeps the promise alive after the response is sent.
  void runBatch(pieceIds);

  return NextResponse.json({ started: pieceIds.length });
}

async function runBatch(pieceIds: string[]) {
  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < pieceIds.length) {
      const myIdx = idx;
      idx += 1;
      const id = pieceIds[myIdx];
      try {
        await generateContentBodyInternal(id);
      } catch (err) {
        // generateContentBodyInternal already resets status to PLANNED on
        // failure, so the operator can retry just the failed pieces by
        // clicking "Generate all" again. We log here for server-side
        // observability.
        console.error(`[BATCH-DRAFT] piece ${id} failed:`, err);
      }
    }
  });
  await Promise.all(workers);
  console.log(`[BATCH-DRAFT] Completed batch of ${pieceIds.length} pieces.`);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  // Three counts the UI cares about — all scoped to *draftable* pieces
  // (same isDraftablePiece filter the Drafts tab uses) so the polling
  // numbers stay in sync with the UI:
  //   - writing:  currently being generated by a worker (no body, status=WRITING)
  //   - pending:  still queued for generation (no body, status≠WRITING, draftable)
  //   - drafted:  body is populated AND piece is draftable
  // When `writing` is 0 the batch is finished. `pending > 0` after a batch
  // ends means some pieces failed and were reset — re-batching picks them up.
  const all = await prisma.contentPiece.findMany({
    where: {
      contentPlan: { clientId },
      status: { not: "REJECTED" },
    },
    select: {
      status: true,
      body: true,
      approval: { select: { outcome: true } },
    },
  });

  let writing = 0;
  let pending = 0;
  let drafted = 0;
  for (const p of all) {
    const outcome = p.approval?.outcome ?? null;
    if (outcome === "rejected" || outcome === "save_for_later") continue;
    const draftable =
      p.status === "APPROVED" ||
      p.status === "DRAFT_REVIEW" ||
      p.status === "CLIENT_REVIEW" ||
      p.status === "WRITING" ||
      outcome === "approved" ||
      outcome === "request_edits";
    if (!draftable) continue;
    if (p.body) {
      drafted += 1;
    } else if (p.status === "WRITING") {
      writing += 1;
    } else {
      pending += 1;
    }
  }

  return NextResponse.json({ writing, pending, drafted });
}
