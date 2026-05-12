import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { verifyCredentials } from "@/lib/wordpress";

/**
 * GET — return whether WordPress is configured for this client (no secrets).
 * PUT — set or clear WordPress credentials. Verifies them against the live site
 *       before persisting; rejects on auth failure so we never store junk.
 */

function ensureAdmin(role: string | undefined) {
  return role === "AGENCY_ADMIN";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!ensureAdmin(session?.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { clientId } = await params;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { wpUrl: true, wpUsername: true, wpAppPasswordEnc: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  return NextResponse.json({
    wpUrl: client.wpUrl,
    wpUsername: client.wpUsername,
    configured: !!(client.wpUrl && client.wpUsername && client.wpAppPasswordEnc),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!ensureAdmin(session?.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { clientId } = await params;
  const body = await req.json().catch(() => ({}));
  const { wpUrl, wpUsername, wpAppPassword } = body as {
    wpUrl?: string | null;
    wpUsername?: string | null;
    wpAppPassword?: string | null;
  };

  // Clear-credentials path: pass any field as empty string and we wipe all three.
  if (wpUrl === "" || wpUsername === "" || wpAppPassword === "") {
    await prisma.client.update({
      where: { id: clientId },
      data: { wpUrl: null, wpUsername: null, wpAppPasswordEnc: null },
    });
    return NextResponse.json({ ok: true, configured: false });
  }

  if (!wpUrl || !wpUsername || !wpAppPassword) {
    return NextResponse.json(
      { error: "wpUrl, wpUsername, and wpAppPassword are required." },
      { status: 400 }
    );
  }

  const cleanedUrl = wpUrl.replace(/\/$/, "");
  const verify = await verifyCredentials({ url: cleanedUrl, username: wpUsername, appPassword: wpAppPassword });
  if (!verify.ok) {
    return NextResponse.json(
      { error: `Could not verify credentials: ${verify.error}` },
      { status: 400 }
    );
  }

  try {
    const enc = encrypt(wpAppPassword);
    await prisma.client.update({
      where: { id: clientId },
      data: {
        wpUrl: cleanedUrl,
        wpUsername,
        wpAppPasswordEnc: enc,
      },
    });

    return NextResponse.json({
      ok: true,
      configured: true,
      verifiedAs: verify.userName,
    });
  } catch (err) {
    console.error("[wordpress/route] Failed to save credentials:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save credentials" },
      { status: 500 }
    );
  }
}
