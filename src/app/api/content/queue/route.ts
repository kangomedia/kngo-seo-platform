import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/content/queue
 * Returns all content pieces across all clients, grouped by status.
 * Supports filtering by ?clientId, ?status, ?type
 */
export async function GET(request: Request) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" &&
      session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  // Build where clause
  const where: Record<string, unknown> = {};

  if (clientId) {
    where.contentPlan = { clientId };
  }

  if (status) {
    // Allow comma-separated statuses
    const statuses = status.split(",").map((s) => s.trim());
    if (statuses.length === 1) {
      where.status = statuses[0];
    } else {
      where.status = { in: statuses };
    }
  }

  if (type) {
    where.type = type;
  }

  const pieces = await prisma.contentPiece.findMany({
    where,
    include: {
      contentPlan: {
        include: {
          client: {
            select: {
              id: true,
              name: true,
              domain: true,
              tier: true,
            },
          },
        },
      },
      approval: true,
    },
    orderBy: [
      { priority: "desc" },
      { dueDate: "asc" },
      { createdAt: "desc" },
    ],
  });

  // Transform for the frontend — flatten client info onto each piece
  const queue = pieces.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    description: p.description,
    keyword: p.keyword,
    body: p.body ? true : false, // don't send full body, just whether it exists
    status: p.status,
    priority: p.priority,
    revisionCount: p.revisionCount,
    dueDate: p.dueDate,
    scheduledPublishDate: p.scheduledPublishDate,
    publishedUrl: p.publishedUrl,
    publishedAt: p.publishedAt,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    planId: p.contentPlanId,
    planTitle: p.contentPlan.title,
    planMonth: p.contentPlan.month,
    planYear: p.contentPlan.year,
    clientId: p.contentPlan.client.id,
    clientName: p.contentPlan.client.name,
    clientDomain: p.contentPlan.client.domain,
    clientTier: p.contentPlan.client.tier,
    approval: p.approval
      ? {
          outcome: p.approval.outcome,
          notes: p.approval.notes,
          decidedAt: p.approval.decidedAt,
        }
      : null,
  }));

  // Also return counts by status for the pipeline header
  const counts = {
    PLANNED: 0,
    APPROVED: 0,
    WRITING: 0,
    CLIENT_REVIEW: 0,
    DRAFT_REVIEW: 0,
    READY_TO_PUBLISH: 0,
    PUBLISHED: 0,
    REJECTED: 0,
    ARCHIVED: 0,
  };

  for (const p of queue) {
    if (p.status in counts) {
      counts[p.status as keyof typeof counts]++;
    }
  }

  return NextResponse.json({ queue, counts });
}
