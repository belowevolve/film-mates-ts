import type { GenericCtx } from "@convex-dev/better-auth";

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

const generateCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// Create an invite link for a list
export const create = mutation({
  args: {
    listId: v.id("lists"),
    role: v.union(v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx as GenericCtx);

    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }
    if (list.ownerId !== (user._id as string)) {
      throw new Error("Only the owner can create invites");
    }

    const code = generateCode();

    await ctx.db.insert("invites", {
      code,
      createdAt: Date.now(),
      createdBy: user._id as string,
      listId: args.listId,
      role: args.role,
    });

    return code;
  },
  returns: v.string(),
});

// Get invite info by code (public - for the invite page)
export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!invite) {
      return null;
    }

    const list = await ctx.db.get(invite.listId);
    if (!list) {
      return null;
    }

    return {
      _id: invite._id,
      listDescription: list.description,
      listId: invite.listId,
      listName: list.name,
      role: invite.role,
    };
  },
  returns: v.union(
    v.object({
      _id: v.id("invites"),
      listDescription: v.optional(v.string()),
      listId: v.id("lists"),
      listName: v.string(),
      role: v.union(v.literal("editor"), v.literal("viewer")),
    }),
    v.null()
  ),
});

// Accept an invite
export const accept = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx as GenericCtx);
    const userId = user._id as string;

    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!invite) {
      throw new Error("Invalid invite code");
    }

    const list = await ctx.db.get(invite.listId);
    if (!list) {
      throw new Error("List no longer exists");
    }

    if (list.ownerId === userId) {
      return invite.listId;
    }

    const existingMembership = await ctx.db
      .query("listMembers")
      .withIndex("by_listId_and_userId", (q) =>
        q.eq("listId", invite.listId).eq("userId", userId)
      )
      .unique();

    if (existingMembership) {
      return invite.listId;
    }

    await ctx.db.insert("listMembers", {
      joinedAt: Date.now(),
      listId: invite.listId,
      role: invite.role,
      userId,
    });

    return invite.listId;
  },
  returns: v.union(v.id("lists"), v.null()),
});

// Get all invites for a list (owner only)
export const getByList = query({
  args: { listId: v.id("lists") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx as GenericCtx);
    if (!user) {
      return [];
    }

    const list = await ctx.db.get(args.listId);
    if (!list || list.ownerId !== (user._id as string)) {
      return [];
    }

    return await ctx.db
      .query("invites")
      .withIndex("by_listId", (q) => q.eq("listId", args.listId))
      .collect();
  },
  returns: v.array(
    v.object({
      _creationTime: v.number(),
      _id: v.id("invites"),
      code: v.string(),
      createdAt: v.number(),
      createdBy: v.string(),
      listId: v.id("lists"),
      role: v.union(v.literal("editor"), v.literal("viewer")),
    })
  ),
});

// Delete an invite
export const remove = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx as GenericCtx);

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Invite not found");
    }

    const list = await ctx.db.get(invite.listId);
    if (!list || list.ownerId !== (user._id as string)) {
      throw new Error("Only the owner can delete invites");
    }

    await ctx.db.delete(args.inviteId);
    return null;
  },
  returns: v.null(),
});
