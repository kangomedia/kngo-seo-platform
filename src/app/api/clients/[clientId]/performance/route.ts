import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchPerformanceSummary, lastNDaysRange, monthRange } from "@/lib/performance";

// GET — Performance / ROI summary for the client.
// Query params:
//   ?days=30           rolling window (default 30)
//   ?month=5&year=2026 specific month (overrides days)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");
  const yearParam = url.searchParams.get("year");
  const daysParam = url.searchParams.get("days");

  let range;
  if (monthParam && yearParam) {
    range = monthRange(parseInt(monthParam, 10), parseInt(yearParam, 10));
  } else {
    range = lastNDaysRange(daysParam ? parseInt(daysParam, 10) : 30);
  }

  try {
    const summary = await fetchPerformanceSummary(clientId, range);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[performance API]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
