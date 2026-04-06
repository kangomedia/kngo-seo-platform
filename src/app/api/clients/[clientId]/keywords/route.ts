import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

  if (!body.keywords || !Array.isArray(body.keywords) || body.keywords.length === 0) {
    return NextResponse.json(
      { error: "keywords array is required" },
      { status: 400 }
    );
  }

  // Validate client exists
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Create keywords, skipping duplicates
  const results = [];
  const skipped = [];

  for (const kw of body.keywords) {
    const keyword = typeof kw === "string" ? kw.trim() : kw.keyword?.trim();
    if (!keyword) continue;

    try {
      const created = await prisma.keyword.create({
        data: {
          clientId,
          keyword,
          searchVolume: typeof kw === "object" ? kw.searchVolume || null : null,
          difficulty: typeof kw === "object" ? kw.difficulty || null : null,
          group: typeof kw === "object" ? kw.group || body.group || null : body.group || null,
          isTracking: true,
        },
      });
      results.push(created);
    } catch (err: unknown) {
      // Unique constraint violation — keyword already exists for this client
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
        skipped.push(keyword);
      } else {
        throw err;
      }
    }
  }

  return NextResponse.json({
    created: results,
    skipped,
    message: `Added ${results.length} keywords${skipped.length > 0 ? `, ${skipped.length} already existed` : ""}`,
  });
}
