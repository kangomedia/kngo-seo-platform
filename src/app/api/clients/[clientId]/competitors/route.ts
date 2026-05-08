// GET  — list all competitors for a client (with classifications)
// POST — manually add a competitor (or bulk-import from a list)
// PATCH — update a single competitor (classification, isAccepted, pillarSlug)
// DELETE — remove a competitor

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function requireAgency() {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const guard = await requireAgency();
  if (guard) return guard;

  const { clientId } = await params;
  const competitors = await prisma.competitor.findMany({
    where: { clientId },
    orderBy: [
      { isAccepted: "desc" },
      { classification: "asc" },
      { discoveredAt: "desc" },
    ],
  });
  return NextResponse.json({ competitors });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const guard = await requireAgency();
  if (guard) return guard;

  const { clientId } = await params;
  const body = await request.json();
  const domains: string[] = Array.isArray(body.domains)
    ? body.domains
    : body.domain
      ? [body.domain]
      : [];

  if (domains.length === 0) {
    return NextResponse.json(
      { error: "domains[] or domain required" },
      { status: 400 }
    );
  }

  const results = [];
  for (const raw of domains) {
    const domain = String(raw)
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .trim()
      .toLowerCase();
    if (!domain) continue;
    const row = await prisma.competitor.upsert({
      where: { clientId_domain: { clientId, domain } },
      create: {
        clientId,
        domain,
        classification: body.classification || "PEER",
        reasoning: body.reasoning || null,
        pillarSlug: body.pillarSlug || null,
        isAccepted: body.isAccepted !== false,
        source: body.source || "manual",
      },
      update: {
        // Re-adding an existing competitor can update classification only.
        ...(body.classification ? { classification: body.classification } : {}),
        ...(body.reasoning !== undefined ? { reasoning: body.reasoning } : {}),
      },
    });
    results.push(row);
  }

  return NextResponse.json({ competitors: results });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const guard = await requireAgency();
  if (guard) return guard;

  const { clientId } = await params;
  const body = await request.json();
  const { id, classification, isAccepted, pillarSlug, reasoning } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.competitor.findFirst({
    where: { id, clientId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
  }

  const updated = await prisma.competitor.update({
    where: { id },
    data: {
      ...(classification !== undefined ? { classification } : {}),
      ...(isAccepted !== undefined ? { isAccepted } : {}),
      ...(pillarSlug !== undefined ? { pillarSlug } : {}),
      ...(reasoning !== undefined ? { reasoning } : {}),
    },
  });

  return NextResponse.json({ competitor: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const guard = await requireAgency();
  if (guard) return guard;

  const { clientId } = await params;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  const existing = await prisma.competitor.findFirst({
    where: { id, clientId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
  }

  await prisma.competitor.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
