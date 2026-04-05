"use server";

import { prisma } from "@/lib/prisma";

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

  return { client, pieces };
}

export async function submitPublicContentApproval(
  accessToken: string,
  contentPieceId: string,
  outcome: "approved" | "rejected" | "save_for_later",
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

  const newStatus =
    outcome === "approved"
      ? "APPROVED"
      : outcome === "rejected"
        ? "REJECTED"
        : "CLIENT_REVIEW";

  await prisma.contentPiece.update({
    where: { id: contentPieceId },
    data: { status: newStatus },
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
