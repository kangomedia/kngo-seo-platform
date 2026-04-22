import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

  return new google.auth.OAuth2(clientId, clientSecret, `${baseUrl}/api/google/callback`);
}

// GET — Handle OAuth callback, exchange code for tokens
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // clientId
  const error = url.searchParams.get("error");

  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (error) {
    console.error("[GOOGLE CALLBACK] OAuth error:", error);
    return NextResponse.redirect(`${baseUrl}/agency/clients/${state || ""}?google_error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/agency/clients?google_error=missing_params`);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Missing tokens in response");
    }

    // Store tokens in DB
    await prisma.googleToken.upsert({
      where: { clientId: state },
      create: {
        clientId: state,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
        scope: tokens.scope || "",
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
        scope: tokens.scope || "",
      },
    });

    console.log(`[GOOGLE CALLBACK] Tokens stored for client ${state}`);
    return NextResponse.redirect(`${baseUrl}/agency/clients/${state}/analytics?connected=true`);
  } catch (err) {
    console.error("[GOOGLE CALLBACK] Token exchange error:", err);
    return NextResponse.redirect(`${baseUrl}/agency/clients/${state}?google_error=token_exchange_failed`);
  }
}
