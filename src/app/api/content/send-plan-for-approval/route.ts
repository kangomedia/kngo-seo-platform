import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, planApprovalEmail } from "@/lib/email";

/** POST: Set ContentPlan.planStatus to PENDING_APPROVAL and send notification email */
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

  // Update plan status to PENDING_APPROVAL
  const plan = await prisma.contentPlan.update({
    where: { id: contentPlanId },
    data: { planStatus: "PENDING_APPROVAL" },
    include: {
      pieces: true,
    },
  });

  // Build the client review URL
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = request.headers.get("host") || "localhost:3000";
  const reviewUrl = `${protocol}://${host}/client/${client.accessToken}/content`;

  // Send notification email to client
  if (client.contactEmail) {
    const { subject, html } = planApprovalEmail(
      client.name,
      plan.title,
      plan.pieces.length,
      reviewUrl,
    );
    sendEmail({ to: client.contactEmail, subject, html }).catch((err) => {
      console.error("[SEND-PLAN-FOR-APPROVAL] Email send failed:", err);
    });
  }

  return NextResponse.json({
    accessToken: client.accessToken,
    clientName: client.name,
    reviewUrl,
    message: `Content plan sent for client approval${client.contactEmail ? ` — email sent to ${client.contactEmail}` : " (no client email configured)"}`,
  });
}
