import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validateBody } from "@/lib/validate";

export const dynamic = "force-dynamic";

/**
 * Body schema for `PATCH .../pages/exclude`. `exclude: false` is the
 * un-exclude path (operator changed their mind), so booleans must be
 * explicitly typed rather than treated as truthy/falsy.
 */
const PagesExcludePatchSchema = z.object({
  pageIds: z.array(z.string().min(1)).min(1, "At least one pageId is required"),
  exclude: z.boolean(),
});

/**
 * PATCH /api/clients/[clientId]/audit/[auditId]/pages/exclude
 *
 * Toggle the excludedFromReport flag on one or more SiteAuditPage records.
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
  const validated = await validateBody(request, PagesExcludePatchSchema);
  if (validated instanceof NextResponse) return validated;
  const { pageIds, exclude } = validated;

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
