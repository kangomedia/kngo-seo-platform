import { NextResponse } from "next/server";
import { generateContentBody } from "@/lib/actions-ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contentPieceId } = body;

    if (!contentPieceId) {
      return NextResponse.json(
        { error: "contentPieceId is required" },
        { status: 400 }
      );
    }

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
