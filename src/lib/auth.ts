import { compare } from "bcryptjs";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user || user.archived) return null;
        // v2-11 : refus si compte non verifie (participant inscrit mais email non confirme)
        // ou compte bloque (moderation). Les staff invites passent par /setup-password qui
        // pose un emailVerifiedAt implicite (cf. seed et flow invitation).
        if (!user.emailVerifiedAt) return null;
        if (user.blocked) return null;
        const ok = await compare(credentials.password, user.password);
        if (!ok) return null;

        await logActivity({ type: "USER_LOGIN", userId: user.id });

        // ADR 2026-06-01 (v2-14 Task 14) : trace la derniere connexion reussie.
        // Fire-and-forget : ne bloque pas le login si l'update echoue.
        prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch((e) => console.error("[auth] lastLoginAt update failed", e));

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isStaff: user.isStaff,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.isStaff = user.isStaff;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
        isStaff: token.isStaff,
      };
      return session;
    },
  },
};
