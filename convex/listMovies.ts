import type { GenericCtx } from "@convex-dev/better-auth";
import type { Infer } from "convex/values";

import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Helper to check access
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

const movieDetailValidator = v.union(
  v.object({
    _id: v.id("movies"),
    originalTitle: v.optional(v.string()),
    overview: v.optional(v.string()),
    posterPath: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    title: v.string(),
    tmdbId: v.number(),
    voteAverage: v.optional(v.number()),
  }),
  v.null()
);

const listMovieWithDetailValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("listMovies"),
  addedAt: v.number(),
  addedBy: v.string(),
  listId: v.id("lists"),
  movie: movieDetailValidator,
  movieId: v.id("movies"),
  note: v.optional(v.string()),
  watched: v.boolean(),
});

export type ListMovieDetail = Infer<typeof listMovieWithDetailValidator>;

// Get all movies in a list
export const getByList = query({
  args: { listId: v.id("lists") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx as GenericCtx);
    if (!user) {
      return [];
    }

    const role = await checkListAccess(ctx, args.listId, user._id as string);
    if (!role) {
      return [];
    }

    const listMovies = await ctx.db
      .query("listMovies")
      .withIndex("by_listId", (q) => q.eq("listId", args.listId))
      .order("desc")
      .collect();

    const moviesWithDetails = await Promise.all(
      listMovies.map(async (lm) => {
        const movie = await ctx.db.get(lm.movieId);
        return {
          _creationTime: lm._creationTime,
          _id: lm._id,
          addedAt: lm.addedAt,
          addedBy: lm.addedBy,
          listId: lm.listId,
          movie: movie
            ? {
                _id: movie._id,
                originalTitle: movie.originalTitle,
                overview: movie.overview,
                posterPath: movie.posterPath,
                releaseDate: movie.releaseDate,
                title: movie.title,
                tmdbId: movie.tmdbId,
                voteAverage: movie.voteAverage,
              }
            : null,
          movieId: lm.movieId,
          note: lm.note,
          watched: lm.watched,
        };
      })
    );

    return moviesWithDetails;
  },
  returns: v.array(listMovieWithDetailValidator),
});

export const addToList = mutation({
  args: {
    backdropPath: v.optional(v.string()),
    genreIds: v.optional(v.array(v.number())),
    listId: v.id("lists"),
    note: v.optional(v.string()),
    originalTitle: v.optional(v.string()),
    overview: v.optional(v.string()),
    posterPath: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    title: v.string(),
    tmdbId: v.number(),
    voteAverage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const movieId = await ctx.runMutation(internal.movies.ensureMovie, {
      backdropPath: args.backdropPath,
      genreIds: args.genreIds,
      originalTitle: args.originalTitle,
      overview: args.overview,
      posterPath: args.posterPath,
      releaseDate: args.releaseDate,
      title: args.title,
      tmdbId: args.tmdbId,
      voteAverage: args.voteAverage,
    });

    await ctx.runMutation(internal.listMovies.addMovieToList, {
      listId: args.listId,
      movieId,
      note: args.note,
    });

    return null;
  },
  returns: v.null(),
});

// Internal mutation to add movie to list (called from action)
export const addMovieToList = internalMutation({
  args: {
    listId: v.id("lists"),
    movieId: v.id("movies"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx as GenericCtx);
    const userId = user._id as string;

    const role = await checkListAccess(ctx, args.listId, userId);
    if (!role || role === "viewer") {
      throw new Error("You don't have permission to add movies to this list");
    }

    const existing = await ctx.db
      .query("listMovies")
      .withIndex("by_listId_and_movieId", (q) =>
        q.eq("listId", args.listId).eq("movieId", args.movieId)
      )
      .unique();

    if (existing) {
      return null;
    }

    await ctx.db.insert("listMovies", {
      addedAt: Date.now(),
      addedBy: userId,
      listId: args.listId,
      movieId: args.movieId,
      note: args.note,
      watched: false,
    });

    return null;
  },
  returns: v.null(),
});

// Toggle watched status
export const toggleWatched = mutation({
  args: { listMovieId: v.id("listMovies") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx as GenericCtx);

    const listMovie = await ctx.db.get(args.listMovieId);
    if (!listMovie) {
      throw new Error("List movie not found");
    }

    const role = await checkListAccess(
      ctx,
      listMovie.listId,
      user._id as string
    );
    if (!role) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.listMovieId, { watched: !listMovie.watched });
    return null;
  },
  returns: v.null(),
});

// Remove a movie from a list
export const removeFromList = mutation({
  args: { listMovieId: v.id("listMovies") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx as GenericCtx);

    const listMovie = await ctx.db.get(args.listMovieId);
    if (!listMovie) {
      throw new Error("List movie not found");
    }

    const role = await checkListAccess(
      ctx,
      listMovie.listId,
      user._id as string
    );
    if (!role || role === "viewer") {
      throw new Error(
        "You don't have permission to remove movies from this list"
      );
    }

    await ctx.db.delete(args.listMovieId);
    return null;
  },
  returns: v.null(),
});

// Update note on a list movie
export const updateNote = mutation({
  args: {
    listMovieId: v.id("listMovies"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx as GenericCtx);

    const listMovie = await ctx.db.get(args.listMovieId);
    if (!listMovie) {
      throw new Error("List movie not found");
    }

    const role = await checkListAccess(
      ctx,
      listMovie.listId,
      user._id as string
    );
    if (!role) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.listMovieId, { note: args.note });
    return null;
  },
  returns: v.null(),
});
