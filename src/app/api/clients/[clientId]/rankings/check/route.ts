import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRankings } from "@/lib/actions-seo";

/** POST: Trigger rank checking for all tracked keywords via DataForSEO SERP */
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

  try {
    const result = await checkRankings(clientId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[RANK CHECK] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to check rankings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
