import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || undefined,
  }),
});

// oxlint-disable-next-line func-style
function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          email,
          name,
          password,
        });
        if (result.error) {
          setError(result.error.message ?? "Ошибка регистрации");
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });
        if (result.error) {
          setError(result.error.message ?? "Ошибка входа");
          return;
        }
      }

      // Redirect back to the original page or home
      if (search?.redirect) {
        window.location.href = search.redirect;
      } else {
        await navigate({ to: "/" });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Что-то пошло не так");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {isSignUp ? "Регистрация" : "Вход"}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? "Создайте аккаунт чтобы начать"
              : "Войдите в свой аккаунт"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ваше имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              {isSignUp ? "Зарегистрироваться" : "Войти"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Уже есть аккаунт?" : "Нет аккаунта?"}{" "}
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline cursor-pointer"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
              >
                {isSignUp ? "Войти" : "Зарегистрироваться"}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
