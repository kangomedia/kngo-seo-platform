"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ─── Client Actions ────────────────────────────────────

export async function getClients() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role === "CLIENT") {
    // Return only clients linked to this user
    const links = await prisma.clientUser.findMany({
      where: { userId: session.user.id },
      include: { client: true },
    });
    return links.map((l) => l.client);
  }

  return prisma.client.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getClient(clientId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // If client role, verify access
  if (session.user.role === "CLIENT") {
    const link = await prisma.clientUser.findUnique({
      where: {
        userId_clientId: {
          userId: session.user.id,
          clientId,
        },
      },
    });
    if (!link) throw new Error("Forbidden");
  }

  return prisma.client.findUnique({
    where: { id: clientId },
    include: {
      keywords: { where: { isTracking: true }, orderBy: { keyword: "asc" } },
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
}

// ─── Keyword Actions ───────────────────────────────────

export async function getKeywords(clientId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return prisma.keyword.findMany({
    where: { clientId, isTracking: true },
    include: {
      snapshots: {
        orderBy: { checkedAt: "desc" },
        take: 2, // latest + previous for delta
      },
    },
    orderBy: { keyword: "asc" },
  });
}

export async function addKeyword(clientId: string, keyword: string, searchVolume?: number, difficulty?: number) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") throw new Error("Unauthorized");

  const created = await prisma.keyword.create({
    data: {
      clientId,
      keyword: keyword.toLowerCase().trim(),
      searchVolume,
      difficulty,
    },
  });

  revalidatePath(`/agency/clients/${clientId}/rankings`);
  return created;
}

// ─── Content Plan Actions ──────────────────────────────

export async function getContentPlan(clientId: string, month: number, year: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return prisma.contentPlan.findUnique({
    where: {
      clientId_month_year: { clientId, month, year },
    },
    include: {
      pieces: {
        orderBy: { sortOrder: "asc" },
        include: { approval: true },
      },
    },
  });
}

export async function getContentForReview(clientId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Get all content pieces in CLIENT_REVIEW status for this client
  return prisma.contentPiece.findMany({
    where: {
      contentPlan: { clientId },
      status: "CLIENT_REVIEW",
    },
    include: {
      contentPlan: true,
      approval: true,
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function submitContentApproval(
  contentPieceId: string,
  outcome: "approved" | "rejected" | "save_for_later",
  notes?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Create approval record
  const approval = await prisma.contentApproval.upsert({
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

  // Update content status based on outcome
  const newStatus = outcome === "approved" ? "APPROVED" : outcome === "rejected" ? "REJECTED" : "CLIENT_REVIEW";

  await prisma.contentPiece.update({
    where: { id: contentPieceId },
    data: { status: newStatus },
  });

  revalidatePath("/client");
  revalidatePath("/agency");

  return approval;
}

// ─── Deliverable Actions ───────────────────────────────

export async function getDeliverables(clientId: string, month: number, year: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return prisma.deliverable.findMany({
    where: { clientId, month, year },
    orderBy: { name: "asc" },
  });
}

export async function getAllDeliverables(month: number, year: number) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") throw new Error("Unauthorized");

  return prisma.deliverable.findMany({
    where: { month, year },
    include: { client: true },
    orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
  });
}

export async function updateDeliverable(id: string, data: { currentCount?: number; status?: string; notes?: string }) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") throw new Error("Unauthorized");

  const updated = await prisma.deliverable.update({
    where: { id },
    data: {
      currentCount: data.currentCount,
      status: data.status as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE" | undefined,
      notes: data.notes,
      completedAt: data.status === "COMPLETED" ? new Date() : undefined,
    },
  });

  revalidatePath("/agency");
  return updated;
}

// ─── Report Actions ────────────────────────────────────

export async function getReports(clientId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return prisma.report.findMany({
    where: { clientId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getPublicReport(uuid: string) {
  // Public — no auth required
  return prisma.report.findUnique({
    where: { uuid },
    include: { client: true },
  });
}

// ─── Settings Actions ──────────────────────────────────

export async function getAgencySettings() {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") throw new Error("Unauthorized");

  return prisma.agencySettings.findUnique({
    where: { id: "default" },
  });
}

export async function updateAgencySettings(data: {
  agencyName?: string;
  dataforseoLogin?: string;
  dataforseoPwd?: string;
  claudeApiKey?: string;
  ghlApiKey?: string;
  ghlLocationId?: string;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY_ADMIN") throw new Error("Unauthorized");

  const updated = await prisma.agencySettings.upsert({
    where: { id: "default" },
    update: data,
    create: {
      id: "default",
      ...data,
    },
  });

  revalidatePath("/agency/settings");
  return updated;
}
