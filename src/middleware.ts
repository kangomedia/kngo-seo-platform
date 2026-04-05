import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  const publicPaths = ["/", "/login", "/report/", "/client/"];
  const isPublic = publicPaths.some((p) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p)
  );

  if (
    isPublic ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // Explicitly use the non-secure cookie name to match useSecureCookies: false
  // in auth.ts config. Without this, getToken() auto-detects https:// from
  // Cloudflare and looks for __Secure-authjs.session-token which doesn't exist.
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName: "authjs.session-token",
  });

  console.log("[MIDDLEWARE]", pathname, "- token:", !!token);

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Agency routes require agency role
  if (pathname.startsWith("/agency")) {
    if (token.role !== "AGENCY_ADMIN" && token.role !== "AGENCY_MEMBER") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/).*)",
  ],
};
