import { v } from "convex/values";

import { action, internalMutation, query } from "./_generated/server";

// Search movies via TMDb API (action because it makes HTTP calls)
export const search = action({
  args: {
    page: v.optional(v.number()),
    query: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      throw new Error("TMDB_API_KEY environment variable is not set");
    }

    const url = new URL("https://api.themoviedb.org/3/search/movie");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("query", args.query);
    url.searchParams.set("language", "ru-RU");
    url.searchParams.set("page", String(args.page ?? 1));

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      results: data.results.map(
        (movie: {
          id: number;
          title: string;
          original_title?: string;
          overview?: string;
          poster_path?: string | null;
          backdrop_path?: string | null;
          release_date?: string;
          vote_average?: number;
          genre_ids?: number[];
        }) => ({
          backdropPath: movie.backdrop_path ?? undefined,
          genreIds: movie.genre_ids ?? undefined,
          id: movie.id,
          originalTitle: movie.original_title ?? undefined,
          overview: movie.overview ?? undefined,
          posterPath: movie.poster_path ?? undefined,
          releaseDate: movie.release_date ?? undefined,
          title: movie.title,
          voteAverage: movie.vote_average ?? undefined,
        })
      ),
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  },
  returns: v.object({
    results: v.array(
      v.object({
        backdropPath: v.optional(v.string()),
        genreIds: v.optional(v.array(v.number())),
        id: v.number(),
        originalTitle: v.optional(v.string()),
        overview: v.optional(v.string()),
        posterPath: v.optional(v.string()),
        releaseDate: v.optional(v.string()),
        title: v.string(),
        voteAverage: v.optional(v.number()),
      })
    ),
    totalPages: v.number(),
    totalResults: v.number(),
  }),
});

// Get popular movies from TMDb
export const popular = action({
  args: {
    page: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      throw new Error("TMDB_API_KEY environment variable is not set");
    }

    const url = new URL("https://api.themoviedb.org/3/movie/popular");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", "ru-RU");
    url.searchParams.set("page", String(args.page ?? 1));

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      results: data.results.map(
        (movie: {
          id: number;
          title: string;
          original_title?: string;
          overview?: string;
          poster_path?: string | null;
          backdrop_path?: string | null;
          release_date?: string;
          vote_average?: number;
          genre_ids?: number[];
        }) => ({
          backdropPath: movie.backdrop_path ?? undefined,
          genreIds: movie.genre_ids ?? undefined,
          id: movie.id,
          originalTitle: movie.original_title ?? undefined,
          overview: movie.overview ?? undefined,
          posterPath: movie.poster_path ?? undefined,
          releaseDate: movie.release_date ?? undefined,
          title: movie.title,
          voteAverage: movie.vote_average ?? undefined,
        })
      ),
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  },
  returns: v.object({
    results: v.array(
      v.object({
        backdropPath: v.optional(v.string()),
        genreIds: v.optional(v.array(v.number())),
        id: v.number(),
        originalTitle: v.optional(v.string()),
        overview: v.optional(v.string()),
        posterPath: v.optional(v.string()),
        releaseDate: v.optional(v.string()),
        title: v.string(),
        voteAverage: v.optional(v.number()),
      })
    ),
    totalPages: v.number(),
    totalResults: v.number(),
  }),
});

// Save a movie to our DB (internal - called from other mutations)
export const ensureMovie = internalMutation({
  args: {
    backdropPath: v.optional(v.string()),
    extra: v.optional(v.string()),
    genreIds: v.optional(v.array(v.number())),
    originalTitle: v.optional(v.string()),
    overview: v.optional(v.string()),
    posterPath: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    title: v.string(),
    tmdbId: v.number(),
    voteAverage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if movie already exists
    const existing = await ctx.db
      .query("movies")
      .withIndex("by_tmdbId", (q) => q.eq("tmdbId", args.tmdbId))
      .unique();

    if (existing) {
      // Update with latest data
      await ctx.db.patch(existing._id, {
        backdropPath: args.backdropPath,
        extra: args.extra,
        genreIds: args.genreIds,
        originalTitle: args.originalTitle,
        overview: args.overview,
        posterPath: args.posterPath,
        releaseDate: args.releaseDate,
        title: args.title,
        voteAverage: args.voteAverage,
      });
      return existing._id;
    }

    return await ctx.db.insert("movies", {
      backdropPath: args.backdropPath,
      extra: args.extra,
      genreIds: args.genreIds,
      originalTitle: args.originalTitle,
      overview: args.overview,
      posterPath: args.posterPath,
      releaseDate: args.releaseDate,
      title: args.title,
      tmdbId: args.tmdbId,
      voteAverage: args.voteAverage,
    });
  },
  returns: v.id("movies"),
});

// Get a movie by its Convex ID
export const getById = query({
  args: { id: v.id("movies") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
  returns: v.union(
    v.object({
      _creationTime: v.number(),
      _id: v.id("movies"),
      backdropPath: v.optional(v.string()),
      extra: v.optional(v.string()),
      genreIds: v.optional(v.array(v.number())),
      originalTitle: v.optional(v.string()),
      overview: v.optional(v.string()),
      posterPath: v.optional(v.string()),
      releaseDate: v.optional(v.string()),
      title: v.string(),
      tmdbId: v.number(),
      voteAverage: v.optional(v.number()),
    }),
    v.null()
  ),
});
