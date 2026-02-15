import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";

interface ListItem {
  _id: Id<"lists">;
  _creationTime: number;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: number;
  role: "owner" | "editor" | "viewer";
}

const roleLabels = {
  editor: "Редактор",
  owner: "Владелец",
  viewer: "Зритель",
} as const;

export const Route = createFileRoute("/")({
  component: Home,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.auth.getCurrentUser, {})
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.lists.getMyLists, {})
      ),
    ]);
  },
});

// oxlint-disable-next-line func-style
function Home() {
  const navigate = useNavigate();
  const { data: user } = useSuspenseQuery(
    convexQuery(api.auth.getCurrentUser, {})
  );
  const { data: lists } = useSuspenseQuery(
    convexQuery(api.lists.getMyLists, {})
  ) as { data: ListItem[] };
  const createList = useMutation(api.lists.create);
  const [newListName, setNewListName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSignOut = useCallback(async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          location.reload();
        },
      },
    });
  }, []);

  const handleCreateList = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newListName.trim()) {
        return;
      }
      const listId = await createList({ name: newListName });
      setNewListName("");
      setIsCreating(false);
      await navigate({ params: { listId }, to: "/lists/$listId" });
    },
    [newListName, createList, navigate]
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Film Mates</h1>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {user.name ?? user.email}
                </span>
                <Button variant="secondary" size="sm" onClick={handleSignOut}>
                  Выйти
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() =>
                  navigate({
                    search: { redirect: location.href },
                    to: "/login",
                  })
                }
              >
                Войти
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {user ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Мои списки</h2>
              {!isCreating && (
                <Button onClick={() => setIsCreating(true)}>
                  Создать список
                </Button>
              )}
            </div>

            {isCreating && (
              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleCreateList} className="flex gap-2">
                    <Input
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="Название списка..."
                      autoFocus
                    />
                    <Button type="submit">Создать</Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setIsCreating(false);
                        setNewListName("");
                      }}
                    >
                      Отмена
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {lists.length === 0 && !isCreating ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p>У вас пока нет списков</p>
                  <p className="text-sm mt-1">
                    Создайте первый список или примите приглашение от друга
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {lists.map((list) => (
                  <Link
                    key={list._id}
                    to="/lists/$listId"
                    params={{ listId: list._id }}
                    className="block"
                  >
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{list.name}</CardTitle>
                          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                            {roleLabels[list.role]}
                          </span>
                        </div>
                        {list.description && (
                          <CardDescription>{list.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">
                          {new Date(list.createdAt).toLocaleDateString("ru-RU")}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 space-y-4">
            <h2 className="text-3xl font-bold">Совместные списки фильмов</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Создавайте списки фильмов, приглашайте друзей и выбирайте что
              посмотреть вместе
            </p>
            <Button
              size="lg"
              onClick={() =>
                navigate({ search: { redirect: location.href }, to: "/login" })
              }
            >
              Начать
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
