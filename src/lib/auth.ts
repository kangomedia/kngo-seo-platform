import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
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

declare module "@auth/core/jwt" {
  interface JWT {
    role?: UserRole;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
        console.log("[AUTH] Authorize called with email:", credentials?.email);
        if (!credentials?.email || !credentials?.password) {
          console.log("[AUTH] Missing credentials");
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });

          console.log("[AUTH] User found:", !!user);

          if (!user || !user.hashedPassword) {
            console.log("[AUTH] No user or no password hash");
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.hashedPassword
          );

          console.log("[AUTH] Password valid:", isValid);

          if (!isValid) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (err) {
          console.error("[AUTH] Error during authorize:", err);
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
