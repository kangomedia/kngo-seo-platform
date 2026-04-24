import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/clients/[clientId]/audit/[auditId]/pages/exclude
 *
 * Toggle the excludedFromReport flag on one or more SiteAuditPage records.
 *
 * Body: { pageIds: string[], exclude: boolean }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string; auditId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, auditId } = await params;
  const body = await request.json();
  const { pageIds, exclude } = body;

  if (!Array.isArray(pageIds) || pageIds.length === 0) {
    return NextResponse.json({ error: "pageIds array is required" }, { status: 400 });
  }

  if (typeof exclude !== "boolean") {
    return NextResponse.json({ error: "exclude (boolean) is required" }, { status: 400 });
  }

  // Verify audit belongs to this client
  const audit = await prisma.siteAudit.findFirst({
    where: { id: auditId, clientId },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  // Update all specified pages
  const result = await prisma.siteAuditPage.updateMany({
    where: {
      id: { in: pageIds },
      auditId,
    },
    data: { excludedFromReport: exclude },
  });

  return NextResponse.json({
    success: true,
    updated: result.count,
    exclude,
  });
}
