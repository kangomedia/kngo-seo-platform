// Debug client index — read-only, header-token gated.
// Lists every client so you can pick an ID to snapshot.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const expected = process.env.DEBUG_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "DEBUG_TOKEN env var is not set on this deployment" },
      { status: 503 }
    );
  }
  const provided = request.headers.get("x-debug-token");
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      domain: true,
      tier: true,
      isActive: true,
      onboardingStatus: true,
      createdAt: true,
      _count: {
        select: {
          keywords: true,
          contentPlans: true,
          reports: true,
        },
      },
    },
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: clients.length,
    clients,
  });
}
