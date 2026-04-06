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
