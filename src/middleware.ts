import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

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

  // req.auth is the session — uses the same cookie config as our NextAuth setup
  const session = req.auth;
  console.log("[MIDDLEWARE]", pathname, "- session:", !!session);

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Agency routes require agency role
  if (pathname.startsWith("/agency")) {
    const role = session.user?.role;
    if (role !== "AGENCY_ADMIN" && role !== "AGENCY_MEMBER") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

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
