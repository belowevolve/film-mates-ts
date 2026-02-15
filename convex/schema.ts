import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Invite links
  invites: defineTable({
    code: v.string(),
    createdAt: v.number(),
    createdBy: v.string(),
    listId: v.id("lists"),
    role: v.union(v.literal("editor"), v.literal("viewer")),
  })
    .index("by_code", ["code"])
    .index("by_listId", ["listId"]),

  // List members (collaborators)
  listMembers: defineTable({
    joinedAt: v.number(),
    listId: v.id("lists"),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    userId: v.string(),
  })
    .index("by_listId", ["listId"])
    .index("by_userId", ["userId"])
    .index("by_listId_and_userId", ["listId", "userId"]),

  // Movies in lists
  listMovies: defineTable({
    addedAt: v.number(),
    addedBy: v.string(),
    listId: v.id("lists"),
    movieId: v.id("movies"),
    note: v.optional(v.string()),
    watched: v.boolean(),
  })
    .index("by_listId", ["listId"])
    .index("by_listId_and_movieId", ["listId", "movieId"]),

  // Movie lists
  lists: defineTable({
    createdAt: v.number(),
    description: v.optional(v.string()),
    name: v.string(),
    // better-auth user id
    ownerId: v.string(),
  }).index("by_ownerId", ["ownerId"]),

  // Movies saved to our DB from TMDb
  movies: defineTable({
    backdropPath: v.optional(v.string()),
    // JSON string for other TMDb fields
    extra: v.optional(v.string()),
    genreIds: v.optional(v.array(v.number())),
    originalTitle: v.optional(v.string()),
    overview: v.optional(v.string()),
    posterPath: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    title: v.string(),
    tmdbId: v.number(),
    voteAverage: v.optional(v.number()),
  }).index("by_tmdbId", ["tmdbId"]),
});
