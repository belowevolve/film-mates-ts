import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import { useCallback, useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import type { ListMovieDetail } from "@/convex/listMovies";
import type { MovieDetail } from "@/convex/movies";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

const posterUrl = (
  path: string | undefined | null,
  size = "w185"
): string | null => {
  if (!path) {
    return null;
  }
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
};

export const Route = createFileRoute("/lists/$listId")({
  component: Page,
  loader: async ({ context, params }) => {
    const listId = params.listId as Id<"lists">;
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.lists.getById, { listId })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.listMovies.getByList, { listId })
      ),
    ]);
  },
});

// oxlint-disable-next-line func-style
function Page() {
  return <ListDetail />;
}

const ListDetail = () => {
  const { listId: rawListId } = Route.useParams();
  const listId = rawListId as Id<"lists">;

  const { data: list } = useSuspenseQuery(
    convexQuery(api.lists.getById, { listId })
  );

  const { data: listMovies } = useSuspenseQuery(
    convexQuery(api.listMovies.getByList, { listId })
  );

  const [showSearch, setShowSearch] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  if (!list) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">Список не найден</p>
          <Link to="/">
            <Button variant="secondary">На главную</Button>
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = list.role === "owner" || list.role === "editor";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Film Mates
            </Link>
            <span className="text-sm text-muted-foreground">/</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{list.name}</h1>
              {list.description && (
                <p className="mt-1 text-muted-foreground">{list.description}</p>
              )}
              <div className="mt-2 flex gap-3 text-sm text-muted-foreground">
                <span>{list.moviesCount} фильмов</span>
                <span>{list.membersCount} участников</span>
              </div>
            </div>
            <div className="flex gap-2">
              {list.role === "owner" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowInvite(!showInvite)}
                >
                  Пригласить
                </Button>
              )}
              {canEdit && (
                <Button size="sm" onClick={() => setShowSearch(!showSearch)}>
                  Добавить фильм
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {showInvite && (
          <InviteSection listId={listId} onClose={() => setShowInvite(false)} />
        )}

        {showSearch && canEdit && (
          <MovieSearch listId={listId} onClose={() => setShowSearch(false)} />
        )}

        {listMovies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>В списке пока нет фильмов</p>
              {canEdit && (
                <p className="mt-1 text-sm">
                  Нажмите &laquo;Добавить фильм&raquo; чтобы найти и добавить
                  фильмы
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {listMovies.map((lm) =>
              lm.movie ? (
                <MovieCard key={lm._id} listMovie={lm} canEdit={canEdit} />
              ) : null
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const MovieCard = ({
  listMovie,
  canEdit,
}: {
  listMovie: ListMovieDetail;
  canEdit: boolean;
}) => {
  const toggleWatched = useMutation(
    api.listMovies.toggleWatched
  ).withOptimisticUpdate((ls, args) => {
    const { listMovieId } = args;

    const listMovies = ls.getQuery(api.listMovies.getByList, {
      listId: listMovie.listId,
    });
    if (!listMovies) {
      return;
    }
    ls.setQuery(
      api.listMovies.getByList,
      {
        listId: listMovie.listId,
      },
      listMovies.map((lm) =>
        lm._id === listMovieId ? { ...lm, watched: !lm.watched } : lm
      )
    );
  });

  const removeFromList = useMutation(
    api.listMovies.removeFromList
  ).withOptimisticUpdate((ls, args) => {
    const { listMovieId } = args;
    const listMovies = ls.getQuery(api.listMovies.getByList, {
      listId: listMovie.listId,
    });

    if (!listMovies) {
      return;
    }

    ls.setQuery(
      api.listMovies.getByList,
      {
        listId: listMovie.listId,
      },
      listMovies.filter((lm) => lm._id !== listMovieId)
    );
  });

  const { movie } = listMovie;
  if (!movie) {
    return null;
  }
  const poster = posterUrl(movie.posterPath);

  return (
    <Card className={listMovie.watched ? "opacity-70" : ""}>
      <CardContent className="flex gap-4 py-4">
        {poster ? (
          <img
            src={poster}
            alt={movie.title}
            className="h-24 w-16 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-muted">
            <span className="text-xs text-muted-foreground">N/A</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3
                className={`font-medium ${listMovie.watched ? "line-through" : ""}`}
              >
                {movie.title}
              </h3>
              {movie.originalTitle && movie.originalTitle !== movie.title && (
                <p className="text-xs text-muted-foreground">
                  {movie.originalTitle}
                </p>
              )}
            </div>
            {movie.voteAverage && (
              <span className="shrink-0 text-sm font-medium">
                {movie.voteAverage.toFixed(1)}
              </span>
            )}
          </div>
          {movie.releaseDate && (
            <p className="mt-1 text-xs text-muted-foreground">
              {movie.releaseDate.slice(0, 4)}
            </p>
          )}
          {movie.overview && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {movie.overview}
            </p>
          )}
          {listMovie.note && (
            <p className="mt-1 text-xs text-primary italic">{listMovie.note}</p>
          )}
          <div className="mt-2 flex gap-2">
            <Button
              variant={listMovie.watched ? "default" : "secondary"}
              size="sm"
              onClick={() => toggleWatched({ listMovieId: listMovie._id })}
            >
              {listMovie.watched ? "Просмотрен" : "Не смотрели"}
            </Button>
            {canEdit && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => removeFromList({ listMovieId: listMovie._id })}
              >
                Убрать
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const MovieSearch = ({
  listId,
  onClose,
}: {
  listId: Id<"lists">;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MovieDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const searchMovies = useAction(api.movies.search);
  const addToList = useMutation(api.listMovies.addToList).withOptimisticUpdate(
    (ls, args) => {
      const { listId, ...movie } = args;

      const listMovies = ls.getQuery(api.listMovies.getByList, { listId });
      if (!listMovies) {
        return;
      }

      const canAdd = listMovies?.every(
        (lm) => lm.movie?.tmdbId !== movie.tmdbId
      );
      if (!canAdd) {
        return;
      }

      const listMovieId = crypto.randomUUID() as Id<"listMovies">;
      const movieId = crypto.randomUUID() as Id<"movies">;
      const now = Date.now();
      const newListMovie = {
        _creationTime: now,
        _id: listMovieId,
        addedAt: now,
        addedBy: "user",
        listId,
        movie: {
          _id: movieId,
          originalTitle: movie.originalTitle,
          overview: movie.overview,
          posterPath: movie.posterPath,
          releaseDate: movie.releaseDate,
          title: movie.title,
          tmdbId: movie.tmdbId,
          voteAverage: movie.voteAverage,
        },
        movieId: movieId,
        note: movie.note,
        watched: false,
      };
      ls.setQuery(
        api.listMovies.getByList,
        {
          listId,
        },
        [newListMovie, ...listMovies]
      );
    }
  );

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) {
        return;
      }
      setLoading(true);
      try {
        const data = await searchMovies({ query });
        setResults(data.results);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    },
    [query, searchMovies]
  );

  const handleAdd = useCallback(
    (movie: MovieDetail) => {
      addToList({
        backdropPath: movie.backdropPath,
        genreIds: movie.genreIds,
        listId,
        originalTitle: movie.originalTitle,
        overview: movie.overview,
        posterPath: movie.posterPath,
        releaseDate: movie.releaseDate,
        title: movie.title,
        tmdbId: movie.id,
        voteAverage: movie.voteAverage,
      });
    },
    [addToList, listId]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Поиск фильмов</CardTitle>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название фильма..."
            autoFocus
          />
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Найти"}
          </Button>
        </form>

        {results.length > 0 && (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {results.map((movie) => {
              const poster = posterUrl(movie.posterPath, "w92");
              return (
                <div
                  key={movie.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
                >
                  {poster ? (
                    <img
                      src={poster}
                      alt={movie.title}
                      className="h-14 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="h-14 w-10 shrink-0 rounded bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {movie.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {movie.releaseDate?.slice(0, 4) ?? "—"}
                      {movie.voteAverage
                        ? ` · ${movie.voteAverage.toFixed(1)}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAdd(movie)}
                  >
                    +
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const InviteSection = ({
  listId,
  onClose,
}: {
  listId: Id<"lists">;
  onClose: () => void;
}) => {
  const createInvite = useMutation(api.invites.create);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [loading, setLoading] = useState(false);

  const handleCreateInvite = useCallback(async () => {
    setLoading(true);
    try {
      const code = await createInvite({ listId, role });
      setInviteCode(code);
    } catch (error) {
      console.error("Failed to create invite:", error);
    } finally {
      setLoading(false);
    }
  }, [createInvite, listId, role]);

  const inviteUrl = inviteCode
    ? `${window.location.origin}/invite/${inviteCode}`
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Пригласить в список</CardTitle>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {inviteCode ? (
          <div className="space-y-3">
            <p className="text-sm">Поделитесь этой ссылкой:</p>
            <div className="flex gap-2">
              <Input value={inviteUrl ?? ""} readOnly />
              <Button
                variant="secondary"
                onClick={() => {
                  if (inviteUrl) {
                    navigator.clipboard.writeText(inviteUrl);
                  }
                }}
              >
                Копировать
              </Button>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setInviteCode(null);
              }}
            >
              Создать ещё
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={role === "editor" ? "default" : "secondary"}
                size="sm"
                onClick={() => setRole("editor")}
              >
                Редактор
              </Button>
              <Button
                variant={role === "viewer" ? "default" : "secondary"}
                size="sm"
                onClick={() => setRole("viewer")}
              >
                Зритель
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {role === "editor"
                ? "Редактор может добавлять и удалять фильмы"
                : "Зритель может только просматривать список"}
            </p>
            <Button onClick={handleCreateInvite} disabled={loading}>
              {loading ? "Создание..." : "Создать ссылку"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
