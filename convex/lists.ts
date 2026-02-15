import type { GenericCtx } from "@convex-dev/better-auth";

import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Helper to check if user has access to a list
const checkListAccess = async (
  ctx: Pick<QueryCtx, "db">,
  listId: Id<"lists">,
  userId: string
): Promise<"owner" | "editor" | "viewer" | null> => {
  const list = await ctx.db.get(listId);
  if (!list) {
    return null;
  }
  if (list.ownerId === userId) {
    return "owner";
  }

  const membership = await ctx.db
    .query("listMembers")
    .withIndex("by_listId_and_userId", (q) =>
      q.eq("listId", listId).eq("userId", userId)
    )
    .unique();

  if (!membership) {
    return null;
  }
  return membership.role;
};

// Reusable validators
const listWithRoleValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("lists"),
  createdAt: v.number(),
  description: v.optional(v.string()),
  name: v.string(),
  ownerId: v.string(),
  role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
});

// Get all lists the current user owns or is a member of
export const getMyLists = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx as GenericCtx);
    if (!user) {
      return [];
    }

    const userId = user._id as string;

    // Get owned lists
    const ownedLists = await ctx.db
      .query("lists")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
      .collect();

    // Get memberships
    const memberships = await ctx.db
      .query("listMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Get lists from memberships
    const memberListIds = memberships.map((m) => m.listId);
    const memberLists = await Promise.all(
      memberListIds.map((id) => ctx.db.get(id))
    );

    const allLists = [
      ...ownedLists.map((l) => ({
        _creationTime: l._creationTime,
        _id: l._id,
        createdAt: l.createdAt,
        description: l.description,
        name: l.name,
        ownerId: l.ownerId,
        role: "owner" as const,
      })),
      ...memberLists
        .filter(
          (l): l is NonNullable<typeof l> => l !== null && l !== undefined
        )
        .map((l, i) => ({
          _creationTime: l._creationTime,
          _id: l._id,
          createdAt: l.createdAt,
          description: l.description,
          name: l.name,
          ownerId: l.ownerId,
          role: memberships[i].role,
        })),
    ];

    // Sort by creation time descending
    allLists.sort((a, b) => b.createdAt - a.createdAt);

    return allLists;
  },
  returns: v.array(listWithRoleValidator),
});

// Get a single list by ID (with access check)
export const getById = query({
  args: { listId: v.id("lists") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx as GenericCtx);
    if (!user) {
      return null;
    }

    const list = await ctx.db.get(args.listId);
    if (!list) {
      return null;
    }

    const role = await checkListAccess(ctx, args.listId, user._id as string);
    if (!role) {
      return null;
    }

    // Get members count
    const members = await ctx.db
      .query("listMembers")
      .withIndex("by_listId", (q) => q.eq("listId", args.listId))
      .collect();

    // Get movies count
    const movies = await ctx.db
      .query("listMovies")
      .withIndex("by_listId", (q) => q.eq("listId", args.listId))
      .collect();

    return {
      _creationTime: list._creationTime,
      _id: list._id,
      createdAt: list.createdAt,
      description: list.description,
      // +1 for owner
      membersCount: members.length + 1,
      moviesCount: movies.length,
      name: list.name,
      ownerId: list.ownerId,
      role,
    };
  },
  returns: v.union(
    v.object({
      _creationTime: v.number(),
      _id: v.id("lists"),
      createdAt: v.number(),
      description: v.optional(v.string()),
      membersCount: v.number(),
      moviesCount: v.number(),
      name: v.string(),
      ownerId: v.string(),
      role: v.union(
        v.literal("owner"),
        v.literal("editor"),
        v.literal("viewer")
      ),
    }),
    v.null()
  ),
});

// Create a new list
export const create = mutation({
  args: {
    description: v.optional(v.string()),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx as GenericCtx);

    return await ctx.db.insert("lists", {
      createdAt: Date.now(),
      description: args.description,
      name: args.name,
      ownerId: user._id as string,
    });
  },
  returns: v.id("lists"),
});

// Update a list
export const update = mutation({
  args: {
    description: v.optional(v.string()),
    listId: v.id("lists"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx as GenericCtx);

    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }
    if (list.ownerId !== (user._id as string)) {
      throw new Error("Only the owner can edit the list");
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }

    await ctx.db.patch(args.listId, updates);
    return null;
  },
  returns: v.null(),
});

// Delete a list
export const remove = mutation({
  args: { listId: v.id("lists") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);

    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }
    if (list.ownerId !== (user._id as string)) {
      throw new Error("Only the owner can delete the list");
    }

    const listMovies = await ctx.db
      .query("listMovies")
      .withIndex("by_listId", (q) => q.eq("listId", args.listId))
      .collect();
    for (const lm of listMovies) {
      await ctx.db.delete(lm._id);
    }

    const listMembers = await ctx.db
      .query("listMembers")
      .withIndex("by_listId", (q) => q.eq("listId", args.listId))
      .collect();
    for (const m of listMembers) {
      await ctx.db.delete(m._id);
    }

    const invites = await ctx.db
      .query("invites")
      .withIndex("by_listId", (q) => q.eq("listId", args.listId))
      .collect();
    for (const inv of invites) {
      await ctx.db.delete(inv._id);
    }

    await ctx.db.delete(args.listId);
    return null;
  },
  returns: v.null(),
});

// Get list members
export const getMembers = query({
  args: { listId: v.id("lists") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx as GenericCtx);
    if (!user) {
      return null;
    }

    const role = await checkListAccess(ctx, args.listId, user._id as string);
    if (!role) {
      return null;
    }

    const list = await ctx.db.get(args.listId);
    if (!list) {
      return null;
    }

    const memberships = await ctx.db
      .query("listMembers")
      .withIndex("by_listId", (q) => q.eq("listId", args.listId))
      .collect();

    return {
      members: memberships.map((m) => ({
        _id: m._id,
        joinedAt: m.joinedAt,
        role: m.role,
        userId: m.userId,
      })),
      owner: { role: "owner" as const, userId: list.ownerId },
    };
  },
  returns: v.union(
    v.object({
      members: v.array(
        v.object({
          _id: v.id("listMembers"),
          joinedAt: v.number(),
          role: v.union(v.literal("editor"), v.literal("viewer")),
          userId: v.string(),
        })
      ),
      owner: v.object({
        role: v.literal("owner"),
        userId: v.string(),
      }),
    }),
    v.null()
  ),
});

// Remove a member from a list
export const removeMember = mutation({
  args: {
    listId: v.id("lists"),
    memberId: v.id("listMembers"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = user._id as string;

    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    // Owner can remove anyone, members can remove themselves
    if (list.ownerId !== userId && member.userId !== userId) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.memberId);
    return null;
  },
  returns: v.null(),
});
