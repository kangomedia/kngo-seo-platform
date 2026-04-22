import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — Get audit detail with pages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string; auditId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, auditId } = await params;

  const audit = await prisma.siteAudit.findFirst({
    where: { id: auditId, clientId },
    include: {
      pages: {
        orderBy: { onpageScore: "asc" },
        include: {
          issues: true,
        },
      },
    },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  return NextResponse.json(audit);
}

// PATCH — Archive or restore an audit
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string; auditId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, auditId } = await params;
  const { action } = await request.json();

  const audit = await prisma.siteAudit.findFirst({
    where: { id: auditId, clientId },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  if (action === "archive") {
    await prisma.siteAudit.update({
      where: { id: auditId },
      data: { archivedAt: new Date() },
    });
    return NextResponse.json({ status: "archived" });
  }

  if (action === "restore") {
    await prisma.siteAudit.update({
      where: { id: auditId },
      data: { archivedAt: null },
    });
    return NextResponse.json({ status: "restored" });
  }

  return NextResponse.json({ error: "Invalid action. Use 'archive' or 'restore'" }, { status: 400 });
}

// DELETE — Permanently delete an audit and all its pages/issues
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string; auditId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, auditId } = await params;

  const audit = await prisma.siteAudit.findFirst({
    where: { id: auditId, clientId },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  // Cascade delete handles pages and issues automatically
  await prisma.siteAudit.delete({
    where: { id: auditId },
  });

  return NextResponse.json({ status: "deleted" });
}
