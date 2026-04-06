import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — List all issues for an audit (with fix status)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const url = new URL(request.url);
  const auditId = url.searchParams.get("auditId");

  if (!auditId) {
    return NextResponse.json({ error: "auditId is required" }, { status: 400 });
  }

  // Verify audit belongs to client
  const audit = await prisma.siteAudit.findFirst({
    where: { id: auditId, clientId },
  });
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const issues = await prisma.auditIssue.findMany({
    where: { page: { auditId } },
    include: { page: { select: { url: true, title: true } } },
    orderBy: [
      { status: "asc" }, // OPEN first
      { severity: "asc" }, // critical first
    ],
  });

  const stats = {
    total: issues.length,
    open: issues.filter((i) => i.status === "OPEN").length,
    fixed: issues.filter((i) => i.status === "FIXED").length,
    ignored: issues.filter((i) => i.status === "IGNORED").length,
  };

  return NextResponse.json({ issues, stats });
}

// PATCH — Update issue status (OPEN, FIXED, IGNORED)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const { issueId, status, fixNotes } = await request.json();

  if (!issueId || !status || !["OPEN", "FIXED", "IGNORED"].includes(status)) {
    return NextResponse.json({ error: "issueId and valid status required" }, { status: 400 });
  }

  // Verify the issue belongs to this client's audit
  const issue = await prisma.auditIssue.findFirst({
    where: { id: issueId },
    include: { page: { include: { audit: true } } },
  });

  if (!issue || issue.page.audit.clientId !== clientId) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const updated = await prisma.auditIssue.update({
    where: { id: issueId },
    data: {
      status,
      fixedAt: status === "FIXED" ? new Date() : null,
      fixNotes: fixNotes || null,
    },
  });

  return NextResponse.json(updated);
}
