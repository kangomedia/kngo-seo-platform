import { NextResponse } from "next/server";
import { z } from "zod";
import { generateContentBody } from "@/lib/actions-ai";
import { auth } from "@/lib/auth";
import { validateBody } from "@/lib/validate";

/**
 * Body schema for `POST /api/content/draft`.
 *
 * Single-piece draft generation. The batch variant (`/drafts/batch`) shares
 * the same `contentPieceId` shape — see also `DraftBatchSchema` in that
 * route. If a field is added here, mirror it there to prevent drift.
 */
const DraftPostSchema = z.object({
  contentPieceId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const validated = await validateBody(request, DraftPostSchema);
    if (validated instanceof NextResponse) return validated;
    const { contentPieceId } = validated;

    const content = await generateContentBody(contentPieceId);

    return NextResponse.json({
      body: content,
      message: "Draft generated successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate draft";
    console.error("[DRAFT] Generation error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
