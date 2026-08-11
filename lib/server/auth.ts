import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";

export const auth = betterAuth({
  appName: "بيِن",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: ["TEACHER", "ADMIN"],
        required: false,
        defaultValue: "TEACHER",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: "basira",
  },
  trustedOrigins: [env.BETTER_AUTH_URL, ...(new URL(env.BETTER_AUTH_URL).hostname === "localhost" ? ["http://127.0.0.1:3000"] : [])],
});

export type AuthSession = typeof auth.$Infer.Session;
