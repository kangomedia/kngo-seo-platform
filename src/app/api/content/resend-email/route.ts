import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

/** POST: Resend an email with custom subject/html (agency admin only) */
export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { to, subject, html } = body;

  if (!to || !subject || !html) {
    return NextResponse.json(
      { error: "to, subject, and html are required" },
      { status: 400 }
    );
  }

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
