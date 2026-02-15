import type { GenericCtx } from "@convex-dev/better-auth";

import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL ?? "";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient(components.betterAuth);

export const createAuth = (ctx: GenericCtx) =>
  betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [convex({ authConfig })],
  });

// Get the current user, or null if not authenticated
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx as GenericCtx);
    if (!user) {
      return null;
    }
    return {
      email: user.email,
      id: user._id as string,
      image: user.image,
      name: user.name,
    };
  },
  returns: v.union(
    v.object({
      email: v.string(),
      id: v.string(),
      image: v.optional(v.union(v.null(), v.string())),
      name: v.string(),
    }),
    v.null()
  ),
});
