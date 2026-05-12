"use server";

import { prisma } from "@/lib/prisma";
import { selectPrimaryPieces, quotasFromClient } from "@/lib/content-plan-utils";
import { fetchPerformanceSummary, lastNDaysRange } from "@/lib/performance";

/**
 * Public client actions — NO authentication required.
 * Clients access their portal via a unique UUID access token in the URL.
 * Security model: unguessable UUIDs (same as Google Docs share links).
 */

export async function getClientByToken(accessToken: string) {
  const client = await prisma.client.findUnique({
    where: { accessToken },
    include: {
      keywords: {
        where: { isTracking: true },
        orderBy: { keyword: "asc" },
        include: {
          snapshots: {
            orderBy: { checkedAt: "desc" },
            take: 2,
          },
        },
      },
      _count: {
        select: {
          keywords: true,
          contentPlans: true,
          deliverables: true,
          reports: true,
        },
      },
    },
  });

  if (!client || !client.isActive) return null;
  return client;
}

export async function getClientContentForReview(accessToken: string) {
  const client = await prisma.client.findUnique({
    where: { accessToken },
  });

  if (!client || !client.isActive) return null;

  // Fetch draft pieces in CLIENT_REVIEW status
  const pieces = await prisma.contentPiece.findMany({
    where: {
      contentPlan: { clientId: client.id },
      status: "CLIENT_REVIEW",
    },
    include: {
      contentPlan: true,
      approval: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  // Also check for a pending plan (for plan review mode)
  const pendingPlan = await prisma.contentPlan.findFirst({
    where: {
      clientId: client.id,
      planStatus: "PENDING_APPROVAL",
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      pieces: {
        orderBy: { sortOrder: "asc" },
        include: { approval: true },
      },
    },
  });

  // The client never sees reserve pieces or any piece they previously
  // rejected/saved-for-later — selectPrimaryPieces handles both cases.
  const quotas = quotasFromClient(client);
  const filteredPieces = selectPrimaryPieces(pieces, quotas);
  const filteredPendingPlan = pendingPlan
    ? { ...pendingPlan, pieces: selectPrimaryPieces(pendingPlan.pieces, quotas) }
    : null;

  return { client, pieces: filteredPieces, pendingPlan: filteredPendingPlan };
}

/**
 * Client highlights a span of text in a draft and leaves a comment on it.
 * Stored as a free-form PieceAnnotation row. Multiple per piece allowed.
 * Token-gated: verifies the piece belongs to the client behind the token.
 */
export async function submitPublicAnnotation(
  accessToken: string,
  contentPieceId: string,
  highlightedText: string,
  comment: string
) {
  const client = await prisma.client.findUnique({ where: { accessToken } });
  if (!client || !client.isActive) throw new Error("Invalid access link");

  const piece = await prisma.contentPiece.findUnique({
    where: { id: contentPieceId },
    include: { contentPlan: true },
  });
  if (!piece || piece.contentPlan.clientId !== client.id) {
    throw new Error("Content not found");
  }

  const trimmedSelection = highlightedText.trim().slice(0, 2000);
  const trimmedComment = comment.trim().slice(0, 4000);
  if (!trimmedSelection || !trimmedComment) {
    throw new Error("Selection and comment are both required");
  }

  const annotation = await prisma.pieceAnnotation.create({
    data: {
      contentPieceId,
      highlightedText: trimmedSelection,
      comment: trimmedComment,
    },
  });

  return {
    success: true,
    annotation: {
      id: annotation.id,
      highlightedText: annotation.highlightedText,
      comment: annotation.comment,
      resolved: annotation.resolved,
      createdAt: annotation.createdAt.toISOString(),
    },
  };
}

/**
 * Returns annotations the client has left on a piece, for the panel that
 * sits next to the draft body. Token-gated like the rest of this file.
 */
export async function getPublicAnnotations(
  accessToken: string,
  contentPieceId: string
) {
  const client = await prisma.client.findUnique({ where: { accessToken } });
  if (!client || !client.isActive) return null;

  const piece = await prisma.contentPiece.findUnique({
    where: { id: contentPieceId },
    include: { contentPlan: true },
  });
  if (!piece || piece.contentPlan.clientId !== client.id) return null;

  const annotations = await prisma.pieceAnnotation.findMany({
    where: { contentPieceId },
    orderBy: { createdAt: "asc" },
  });

  return annotations.map((a) => ({
    id: a.id,
    highlightedText: a.highlightedText,
    comment: a.comment,
    resolved: a.resolved,
    createdAt: a.createdAt.toISOString(),
  }));
}

/**
 * Client deletes their own annotation. We allow this so an over-eager
 * comment can be retracted before the agency sees it. Once resolved by the
 * agency, the row is preserved as a historical record (resolved=true).
 */
export async function deletePublicAnnotation(
  accessToken: string,
  annotationId: string
) {
  const client = await prisma.client.findUnique({ where: { accessToken } });
  if (!client || !client.isActive) throw new Error("Invalid access link");

  const annotation = await prisma.pieceAnnotation.findUnique({
    where: { id: annotationId },
    include: { contentPiece: { include: { contentPlan: true } } },
  });
  if (!annotation || annotation.contentPiece.contentPlan.clientId !== client.id) {
    throw new Error("Annotation not found");
  }
  if (annotation.resolved) {
    // Once resolved, only the agency can delete.
    throw new Error("Cannot delete a resolved annotation");
  }

  await prisma.pieceAnnotation.delete({ where: { id: annotationId } });
  return { success: true };
}

export async function submitPublicContentApproval(
  accessToken: string,
  contentPieceId: string,
  outcome: "approved" | "rejected" | "save_for_later" | "request_edits",
  notes?: string
) {
  // Verify the token matches the content piece's client
  const client = await prisma.client.findUnique({
    where: { accessToken },
  });

  if (!client || !client.isActive) {
    throw new Error("Invalid access link");
  }

  // Verify this content piece belongs to this client
  const piece = await prisma.contentPiece.findUnique({
    where: { id: contentPieceId },
    include: { contentPlan: true },
  });

  if (!piece || piece.contentPlan.clientId !== client.id) {
    throw new Error("Content not found");
  }

  // Save the approval
  await prisma.contentApproval.upsert({
    where: { contentPieceId },
    update: {
      outcome,
      notes,
      decidedAt: new Date(),
    },
    create: {
      contentPieceId,
      outcome,
      notes,
    },
  });

  // Status transitions:
  //   approved        → APPROVED       (ready for publishing)
  //   rejected        → REJECTED       (won't be published)
  //   request_edits   → DRAFT_REVIEW   (back to agency for revision; revisionCount++)
  //   save_for_later  → CLIENT_REVIEW  (legacy plan-review behavior; piece stays for re-review)
  const newStatus =
    outcome === "approved"
      ? "APPROVED"
      : outcome === "rejected"
        ? "REJECTED"
        : outcome === "request_edits"
          ? "DRAFT_REVIEW"
          : "CLIENT_REVIEW";

  await prisma.contentPiece.update({
    where: { id: contentPieceId },
    data: {
      status: newStatus,
      ...(outcome === "request_edits" ? { revisionCount: { increment: 1 } } : {}),
    },
  });

  return { success: true };
}

export async function getClientReports(accessToken: string) {
  const client = await prisma.client.findUnique({
    where: { accessToken },
  });

  if (!client || !client.isActive) return null;

  const reports = await prisma.report.findMany({
    where: { clientId: client.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return { client, reports };
}

export async function getClientStrategy(accessToken: string) {
  const client = await prisma.client.findUnique({ where: { accessToken } });
  if (!client || !client.isActive) return null;

  const map = await prisma.contentMap.findFirst({
    where: { clientId: client.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!map) return null;

  let mapData;
  try {
    mapData = JSON.parse(map.mapData);
  } catch {
    return null;
  }

  return {
    id: map.id,
    title: map.title,
    aiSummary: map.aiSummary,
    createdAt: map.createdAt,
    mapData,
  };
}

export async function getClientPerformance(accessToken: string, days: number = 30) {
  const client = await prisma.client.findUnique({ where: { accessToken } });
  if (!client || !client.isActive) return null;

  try {
    const range = lastNDaysRange(days);
    return await fetchPerformanceSummary(client.id, range);
  } catch (err) {
    console.error("[getClientPerformance]", err);
    return null;
  }
}

export async function getClientRankHistory(accessToken: string, days: number = 30) {
  const client = await prisma.client.findUnique({
    where: { accessToken },
  });

  if (!client || !client.isActive) return null;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const snapshots = await prisma.rankSnapshot.findMany({
    where: {
      clientId: client.id,
      checkedAt: { gte: since },
    },
    include: { keyword: true },
    orderBy: { checkedAt: "asc" },
  });

  return snapshots;
}

export async function getClientPlanForReview(accessToken: string) {
  const client = await prisma.client.findUnique({
    where: { accessToken },
  });

  if (!client || !client.isActive) return null;

  // Find the most recent plan that is PENDING_APPROVAL
  const plan = await prisma.contentPlan.findFirst({
    where: {
      clientId: client.id,
      planStatus: "PENDING_APPROVAL",
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      pieces: {
        orderBy: { sortOrder: "asc" },
        include: { approval: true },
      },
    },
  });

  if (!plan) return { client, plan: null };

  const quotas = quotasFromClient(client);
  return {
    client,
    plan: { ...plan, pieces: selectPrimaryPieces(plan.pieces, quotas) },
  };
}

export async function submitPublicPlanApproval(
  accessToken: string,
  contentPlanId: string,
  outcome: "approved" | "rejected",
  notes?: string,
  pieceDecisions?: Array<{ pieceId: string; outcome: string; notes?: string }>
) {
  const client = await prisma.client.findUnique({
    where: { accessToken },
  });

  if (!client || !client.isActive) {
    throw new Error("Invalid access link");
  }

  // Verify this plan belongs to this client
  const plan = await prisma.contentPlan.findUnique({
    where: { id: contentPlanId },
  });

  if (!plan || plan.clientId !== client.id) {
    throw new Error("Content plan not found");
  }

  // Save per-piece decisions if provided
  if (pieceDecisions && pieceDecisions.length > 0) {
    for (const pd of pieceDecisions) {
      await prisma.contentApproval.upsert({
        where: { contentPieceId: pd.pieceId },
        update: {
          outcome: pd.outcome,
          notes: pd.notes || null,
          decidedAt: new Date(),
        },
        create: {
          contentPieceId: pd.pieceId,
          outcome: pd.outcome,
          notes: pd.notes || null,
        },
      });

      // Update the piece's status to reflect the decision
      const newPieceStatus =
        pd.outcome === "approved"
          ? "APPROVED"
          : pd.outcome === "rejected"
            ? "REJECTED"
            : "PLANNED"; // save_for_later stays PLANNED

      await prisma.contentPiece.update({
        where: { id: pd.pieceId },
        data: { status: newPieceStatus },
      });
    }
  }

  const newStatus = outcome === "approved" ? "APPROVED" : "REJECTED";

  await prisma.contentPlan.update({
    where: { id: contentPlanId },
    data: {
      planStatus: newStatus,
      planNotes: notes || null,
    },
  });

  return { success: true };
}
