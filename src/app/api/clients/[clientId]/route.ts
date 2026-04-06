import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
