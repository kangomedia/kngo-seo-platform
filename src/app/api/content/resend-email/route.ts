import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { validateBody } from "@/lib/validate";

/**
 * Body schema for `POST /api/content/resend-email`.
 *
 * Free-form email send used by the approval-preview modal. The shape is
 * intentionally permissive on `html` (could be arbitrarily long); we just
 * enforce non-empty + valid email recipient.
 */
const ResendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(1),
  html: z.string().min(1),
});

/** POST: Resend an email with custom subject/html (agency admin only) */
export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validated = await validateBody(request, ResendEmailSchema);
  if (validated instanceof NextResponse) return validated;
  const { to, subject, html } = validated;

  const result = await sendEmail({ to, subject, html });

  if (result) {
    return NextResponse.json({
      success: true,
      message: `Email sent to ${to}`,
      emailId: result.id,
    });
  }

  return NextResponse.json(
    { error: "Failed to send email — check Resend configuration" },
    { status: 500 }
  );
}
