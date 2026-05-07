import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Matches the UserRole enum in prisma/schema.prisma
type UserRole = "AGENCY_ADMIN" | "AGENCY_MEMBER" | "CLIENT";

declare module "next-auth" {
  interface User {
    role?: UserRole;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
  }
}

// Cookies are insecure (no Secure flag) only when explicitly opted in via
// AUTH_INSECURE_COOKIES=true. This is needed when running behind a TLS-
// terminating reverse proxy (Coolify/Traefik, Cloudflare) where the upstream
// connection is HTTP. In every other case, cookies must be Secure.
const useSecureCookies =
  process.env.AUTH_INSECURE_COOKIES === "true" ? false : process.env.NODE_ENV === "production";

const authDebug = process.env.AUTH_DEBUG === "true";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  debug: authDebug,
  useSecureCookies,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user || !user.hashedPassword) return null;

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.hashedPassword
          );
          if (!isValid) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (err) {
          if (authDebug) console.error("[AUTH] authorize error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
});
