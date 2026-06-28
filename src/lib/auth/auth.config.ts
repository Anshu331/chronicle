import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible Auth.js config — no Node.js providers (mongoose, bcrypt).
 * Used by middleware. Full providers are added in config.ts.
 */
export const authConfig = {
  providers: [],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
