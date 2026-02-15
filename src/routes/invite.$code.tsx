import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";

export const Route = createFileRoute("/invite/$code")({
  component: InvitePage,
  loader: async ({ context, params }) => {
    // Only load invite info — getCurrentUser may return null for anon, that's fine
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.auth.getCurrentUser, {})
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.invites.getByCode, { code: params.code })
      ),
    ]);
  },
});

// oxlint-disable-next-line func-style
function InvitePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();

  const { data: user } = useSuspenseQuery(
    convexQuery(api.auth.getCurrentUser, {})
  );

  const { data: invite } = useSuspenseQuery(
    convexQuery(api.invites.getByCode, { code })
  );

  const acceptInvite = useMutation(api.invites.accept);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listId = await acceptInvite({ code });
      if (listId) {
        await navigate({ params: { listId }, to: "/lists/$listId" });
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка при принятии приглашения"
      );
    } finally {
      setLoading(false);
    }
  }, [acceptInvite, code, navigate]);

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Приглашение не найдено</CardTitle>
            <CardDescription>
              Ссылка недействительна или была удалена
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/">
              <Button variant="secondary">На главную</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Приглашение в список</CardTitle>
            <CardDescription>
              Вас приглашают в список &laquo;{invite.listName}&raquo;
              {invite.role === "editor" ? " как редактора" : " как зрителя"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Войдите или зарегистрируйтесь, чтобы принять приглашение
            </p>
            <Link to="/login" search={{ redirect: `/invite/${code}` }}>
              <Button>Войти</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Приглашение в список</CardTitle>
          <CardDescription>
            Вас приглашают в список &laquo;{invite.listName}&raquo;
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {invite.listDescription && (
            <p className="text-sm text-muted-foreground">
              {invite.listDescription}
            </p>
          )}
          <p className="text-sm">
            Роль:{" "}
            <span className="font-medium">
              {invite.role === "editor" ? "Редактор" : "Зритель"}
            </span>
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 justify-center">
            <Button onClick={handleAccept} disabled={loading}>
              {loading ? "Принятие..." : "Принять приглашение"}
            </Button>
            <Link to="/">
              <Button variant="secondary">Отклонить</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
