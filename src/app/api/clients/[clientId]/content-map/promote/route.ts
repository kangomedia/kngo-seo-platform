// POST /api/clients/[clientId]/content-map/promote
//
// Promotes a piece from a ContentMap into a real ContentPiece in the
// targeted month's ContentPlan. Idempotent on the map side — if the same
// pieceId is promoted twice the second call is a no-op (returns the existing
// ContentPiece).
//
// Body: { mapId: string, pieceId: string, month?: number, year?: number }
// If month/year are omitted, promotes into the *current* month's plan
// (the plan is created on the fly if it doesn't exist).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface MapPiece {
  id: string;
  type: string;
  title: string;
  keyword?: string;
  description?: string;
  funnelStage?: string;
  monthIndex?: number;
  priority?: number;
  promoted?: boolean;
  contentPieceId?: string;
  pillarSlug?: string;
}

interface MapPillar {
  slug: string;
  title: string;
  pieces?: MapPiece[];
}

interface MapData {
  pillars?: MapPillar[];
  quickWins?: MapPiece[];
  monthlyFocus?: Record<string, string>;
}

const VALID_TYPES = new Set([
  "BLOG_POST",
  "GBP_POST",
  "GBP_QA",
  "PRESS_RELEASE",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" &&
      session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const body = await request.json();
  const { mapId, pieceId, month: bodyMonth, year: bodyYear } = body || {};

  if (!mapId || !pieceId) {
    return NextResponse.json(
      { error: "mapId and pieceId are required" },
      { status: 400 }
    );
  }

  const map = await prisma.contentMap.findFirst({
    where: { id: mapId, clientId },
  });
  if (!map) {
    return NextResponse.json({ error: "Content map not found" }, { status: 404 });
  }

  // NOTE: this route intentionally uses inline `JSON.parse` rather than
  // `parseContentMapData` from parsers.ts. The promote flow mutates the map
  // and re-serializes it — it needs to fail LOUDLY on malformed JSON (500)
  // rather than silently treat the map as empty, because writing back an
  // accidentally-empty mapData would destroy the operator's content strategy.
  // The other two read sites (content-map GET, content-map/active GET) are
  // pure reads and can tolerate the permissive parser's fallback. A strict
  // variant of parseContentMapData (returning null on failure) would let this
  // route migrate too — tracked as parser-migration backlog.
  let mapData: MapData;
  try {
    mapData = JSON.parse(map.mapData);
  } catch {
    return NextResponse.json(
      { error: "Content map JSON is malformed" },
      { status: 500 }
    );
  }

  // Find the piece in either pillars or quickWins
  let foundPiece: MapPiece | null = null;
  let pillarTitle: string | null = null;

  if (Array.isArray(mapData.pillars)) {
    for (const pillar of mapData.pillars) {
      if (!Array.isArray(pillar.pieces)) continue;
      const p = pillar.pieces.find((x) => x.id === pieceId);
      if (p) {
        foundPiece = p;
        pillarTitle = pillar.title;
        break;
      }
    }
  }
  if (!foundPiece && Array.isArray(mapData.quickWins)) {
    foundPiece =
      mapData.quickWins.find((q) => q.id === pieceId) || null;
    if (foundPiece) pillarTitle = "Quick Wins";
  }
  if (!foundPiece) {
    return NextResponse.json({ error: "Piece not found in map" }, { status: 404 });
  }

  // Idempotency: already promoted → return the existing piece if it still exists.
  if (foundPiece.promoted && foundPiece.contentPieceId) {
    const existing = await prisma.contentPiece.findUnique({
      where: { id: foundPiece.contentPieceId },
    });
    if (existing) {
      return NextResponse.json({
        alreadyPromoted: true,
        contentPiece: existing,
      });
    }
    // The piece was deleted from the plan — fall through and re-create it.
  }

  // Resolve target month/year — defaults to current month
  const now = new Date();
  const month = Number.isInteger(bodyMonth) ? bodyMonth : now.getMonth() + 1;
  const year = Number.isInteger(bodyYear) ? bodyYear : now.getFullYear();

  // Find or create the ContentPlan for this month
  let plan = await prisma.contentPlan.findUnique({
    where: { clientId_month_year: { clientId, month, year } },
  });
  if (!plan) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    plan = await prisma.contentPlan.create({
      data: {
        clientId,
        month,
        year,
        title: `${monthNames[month - 1]} ${year} Content Plan`,
        seedKeyword: foundPiece.keyword || null,
        planStatus: "DRAFT",
        isActive: true,
      },
    });
  }

  // Create the ContentPiece
  const type = VALID_TYPES.has(foundPiece.type) ? foundPiece.type : "BLOG_POST";
  const sortOrder = await prisma.contentPiece.count({
    where: { contentPlanId: plan.id },
  });

  // Description is shown to the CLIENT on the public review portal. Earlier
  // versions appended "_Pillar: X_" and "_Funnel stage: TOFU_" metadata to
  // help the agency context-switch, but that jargon shouldn't reach the
  // client. The internal pillar/funnel info is still available on the
  // Strategy tab and via the ContentMap row.
  const piece = await prisma.contentPiece.create({
    data: {
      contentPlanId: plan.id,
      type: type as "BLOG_POST" | "GBP_POST" | "GBP_QA" | "PRESS_RELEASE",
      title: foundPiece.title,
      keyword: foundPiece.keyword || null,
      description: foundPiece.description?.trim() || null,
      status: "PLANNED",
      priority: foundPiece.priority ?? 0,
      sortOrder,
    },
  });
  // `pillarTitle` is left assigned but unused now; retained because the
  // surrounding code is structured around it for future tagging.
  void pillarTitle;

  // Mark promoted in the map JSON and persist
  foundPiece.promoted = true;
  foundPiece.contentPieceId = piece.id;
  await prisma.contentMap.update({
    where: { id: map.id },
    data: { mapData: JSON.stringify(mapData) },
  });

  return NextResponse.json({
    contentPiece: piece,
    plan: { id: plan.id, month: plan.month, year: plan.year },
  });
}

// Optional: un-promote (delete the ContentPiece + clear promoted flag)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" &&
      session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const url = new URL(request.url);
  const mapId = url.searchParams.get("mapId");
  const pieceId = url.searchParams.get("pieceId");

  if (!mapId || !pieceId) {
    return NextResponse.json(
      { error: "mapId and pieceId query params required" },
      { status: 400 }
    );
  }

  const map = await prisma.contentMap.findFirst({
    where: { id: mapId, clientId },
  });
  if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });

  let mapData: MapData;
  try {
    mapData = JSON.parse(map.mapData);
  } catch {
    return NextResponse.json({ error: "Bad map JSON" }, { status: 500 });
  }

  // Find the piece
  let target: MapPiece | null = null;
  if (Array.isArray(mapData.pillars)) {
    for (const pillar of mapData.pillars) {
      if (!Array.isArray(pillar.pieces)) continue;
      const p = pillar.pieces.find((x) => x.id === pieceId);
      if (p) {
        target = p;
        break;
      }
    }
  }
  if (!target && Array.isArray(mapData.quickWins)) {
    target = mapData.quickWins.find((q) => q.id === pieceId) || null;
  }
  if (!target) return NextResponse.json({ error: "Piece not found" }, { status: 404 });

  // Delete the linked ContentPiece if it exists and isn't already published
  if (target.contentPieceId) {
    const existing = await prisma.contentPiece.findUnique({
      where: { id: target.contentPieceId },
    });
    if (existing && existing.status !== "PUBLISHED") {
      await prisma.contentPiece.delete({ where: { id: existing.id } });
    }
  }

  target.promoted = false;
  target.contentPieceId = undefined;
  await prisma.contentMap.update({
    where: { id: map.id },
    data: { mapData: JSON.stringify(mapData) },
  });

  return NextResponse.json({ success: true });
}
