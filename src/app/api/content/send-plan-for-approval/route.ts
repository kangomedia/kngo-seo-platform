import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, planApprovalEmail } from "@/lib/email";
import { validateBody } from "@/lib/validate";

/**
 * Body schema for `POST /api/content/send-plan-for-approval`.
 * Same surface as `send-for-approval`. Kept aligned deliberately.
 */
const SendPlanForApprovalSchema = z.object({
  clientId: z.string().min(1),
  contentPlanId: z.string().min(1),
  skipEmail: z.boolean().optional(),
});

/** Body schema for `PATCH /api/content/send-plan-for-approval`. */
const PlanStatusPatchSchema = z.object({
  contentPlanId: z.string().min(1),
  planStatus: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED"]),
});

/** POST: Set ContentPlan.planStatus to PENDING_APPROVAL and send notification email */
export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validated = await validateBody(request, SendPlanForApprovalSchema);
  if (validated instanceof NextResponse) return validated;
  const body = validated;
  const { clientId, contentPlanId } = body;

  // Get the client's access token and contact email
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { 
      accessToken: true, 
      name: true, 
      contactEmail: true,
      monthlyBlogs: true,
      monthlyGbpPosts: true,
      monthlyGbpQAs: true,
      monthlyPressReleases: true
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Update plan status to PENDING_APPROVAL
  const plan = await prisma.contentPlan.update({
    where: { id: contentPlanId },
    data: { planStatus: "PENDING_APPROVAL" },
    include: {
      pieces: {
        include: { approval: true },
        orderBy: { sortOrder: "asc" }
      },
    },
  });

  // Build the client review URL
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = request.headers.get("host") || "localhost:3000";
  const reviewUrl = `${protocol}://${host}/client/${client.accessToken}/content`;

  // Calculate the actual number of pieces the client will see based on their quota
  const quotaTargets: Record<string, number> = {
    BLOG_POST: client.monthlyBlogs || 0,
    GBP_POST: client.monthlyGbpPosts || 0,
    GBP_QA: client.monthlyGbpQAs || 0,
    PRESS_RELEASE: client.monthlyPressReleases || 0,
  };
  
  let displayCount = 0;
  const approvedCounts: Record<string, number> = { BLOG_POST: 0, GBP_POST: 0, GBP_QA: 0, PRESS_RELEASE: 0 };
  const pendingCounts: Record<string, number> = { BLOG_POST: 0, GBP_POST: 0, GBP_QA: 0, PRESS_RELEASE: 0 };
  
  for (const p of plan.pieces) {
    if (p.approval?.outcome === "approved") {
      approvedCounts[p.type] = (approvedCounts[p.type] || 0) + 1;
    } else if (p.approval?.outcome !== "rejected" && p.approval?.outcome !== "save_for_later") {
      // It's unreviewed
      if ((approvedCounts[p.type] || 0) + (pendingCounts[p.type] || 0) < (quotaTargets[p.type] || 0)) {
        pendingCounts[p.type] = (pendingCounts[p.type] || 0) + 1;
        displayCount++;
      }
    }
  }

  // Send notification email to client (unless frontend is handling it via preview modal)
  if (client.contactEmail && !body.skipEmail) {
    const { subject, html } = planApprovalEmail(
      client.name,
      plan.title,
      displayCount,
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

/** PATCH: Manually update ContentPlan.planStatus without sending email */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validated = await validateBody(request, PlanStatusPatchSchema);
  if (validated instanceof NextResponse) return validated;
  const { contentPlanId, planStatus } = validated;

  await prisma.contentPlan.update({
    where: { id: contentPlanId },
    data: { planStatus },
  });

  return NextResponse.json({ success: true, planStatus });
}
