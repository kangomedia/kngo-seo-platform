import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, contentReviewEmail } from "@/lib/email";
import { validateBody } from "@/lib/validate";

/**
 * Body schema for `POST /api/content/send-for-approval`.
 *
 * `skipEmail` lets the wizard's preview-modal flow skip the email send
 * (it sends its own preview-rendered version). Shared shape with
 * `send-plan-for-approval` and `resend-email` for the same operator surface.
 */
const SendForApprovalSchema = z.object({
  clientId: z.string().min(1),
  contentPlanId: z.string().min(1),
  skipEmail: z.boolean().optional(),
});

/** POST: Mark all drafted content pieces as CLIENT_REVIEW and send notification email */
export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validated = await validateBody(request, SendForApprovalSchema);
  if (validated instanceof NextResponse) return validated;
  const body = validated;
  const { clientId, contentPlanId } = body;

  // Get the client's access token and contact email
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { accessToken: true, name: true, contactEmail: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Promote any drafted pieces (DRAFT_REVIEW = ready, CLIENT_REVIEW = already
  // sent and being re-sent) to CLIENT_REVIEW so the client portal exposes them.
  const updated = await prisma.contentPiece.updateMany({
    where: {
      contentPlanId,
      body: { not: null },
      status: { in: ["DRAFT_REVIEW", "CLIENT_REVIEW"] },
    },
    data: {
      status: "CLIENT_REVIEW",
    },
  });

  // Build the client review URL
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = request.headers.get("host") || "localhost:3000";
  const reviewUrl = `${protocol}://${host}/client/${client.accessToken}/content`;

  // Send notification email to client (unless frontend is handling it via preview modal)
  if (client.contactEmail && updated.count > 0 && !body.skipEmail) {
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
