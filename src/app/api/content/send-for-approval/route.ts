import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, contentReviewEmail } from "@/lib/email";

/** POST: Mark all drafted content pieces as CLIENT_REVIEW and send notification email */
export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { clientId, contentPlanId } = body;

  if (!clientId || !contentPlanId) {
    return NextResponse.json(
      { error: "clientId and contentPlanId are required" },
      { status: 400 }
    );
  }

  // Get the client's access token and contact email
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { accessToken: true, name: true, contactEmail: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Find all content pieces with a body that are still in PLANNED or WRITING status
  const updated = await prisma.contentPiece.updateMany({
    where: {
      contentPlanId,
      body: { not: null },
      status: { in: ["PLANNED", "WRITING", "CLIENT_REVIEW"] },
    },
    data: {
      status: "CLIENT_REVIEW",
    },
  });

  // Build the client review URL
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = request.headers.get("host") || "localhost:3000";
  const reviewUrl = `${protocol}://${host}/client/${client.accessToken}/content`;

  // Send notification email to client
  if (client.contactEmail && updated.count > 0) {
    const { subject, html } = contentReviewEmail(
      client.name,
      updated.count,
      reviewUrl,
    );
    sendEmail({ to: client.contactEmail, subject, html }).catch((err) => {
      console.error("[SEND-FOR-APPROVAL] Email send failed:", err);
    });
  }

  return NextResponse.json({
    updatedCount: updated.count,
    accessToken: client.accessToken,
    clientName: client.name,
    reviewUrl,
    message: `${updated.count} content piece(s) sent for approval${client.contactEmail ? ` — email sent to ${client.contactEmail}` : " (no client email configured)"}`,
  });
}
