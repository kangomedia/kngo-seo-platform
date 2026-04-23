import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      keywords: {
        where: { isTracking: true },
        include: {
          snapshots: {
            orderBy: { checkedAt: "desc" },
            take: 2, // current + previous
          },
        },
      },
      contentPlans: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        include: {
          pieces: {
            orderBy: { sortOrder: "asc" },
            include: { approval: true },
          },
        },
      },
      deliverables: {
        orderBy: [{ year: "desc" }, { month: "desc" }, { name: "asc" }],
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(client);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const body = await request.json();

  // Whitelist editable fields
  const allowed: Record<string, unknown> = {};
  const editableFields = [
    "name", "domain", "logoUrl", "tier", "isActive",
    "contactName", "contactEmail", "contactPhone",
    "address", "city", "state", "zip", "notes",
    "gbpName", "gbpUrl", "gbpPhone", "gbpAddress", "gbpCategory",
    "monthlyBlogs", "monthlyGbpPosts", "monthlyGbpQAs", "monthlyPressReleases",
    "monthlyDirectoryListings", "includesAudit", "includesReporting",
    "gscProperty", "ga4PropertyId", "sitemapUrl",
    // Business Profile (AI keyword targeting)
    "businessDescription", "primaryServices", "idealClientProfile",
    "priceRange", "industryVertical",
  ];

  for (const field of editableFields) {
    if (body[field] !== undefined) {
      allowed[field] = body[field];
    }
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: allowed,
  });

  return NextResponse.json(updated);
}

// ─── Soft Delete (Archive) ──────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const body = await request.json();

  // Only allow toggling isActive via PATCH
  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive (boolean) is required" }, { status: 400 });
  }

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: { isActive: body.isActive },
  });

  return NextResponse.json(updated);
}

// ─── Permanent Delete ───────────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  // Verify client exists before deleting
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Cascade delete handles all related data (keywords, snapshots, content plans, etc.)
  await prisma.client.delete({ where: { id: clientId } });

  return NextResponse.json({ success: true, deleted: client.name });
}
