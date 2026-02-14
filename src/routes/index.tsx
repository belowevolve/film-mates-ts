import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

// oxlint-disable-next-line import/no-relative-parent-imports
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
  component: Home,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.auth.getCurrentUser, {})
    );
  },
});

// oxlint-disable-next-line func-style
function Home() {
  const navigate = useNavigate();
  const { data: user } = useSuspenseQuery(
    convexQuery(api.auth.getCurrentUser, {})
  );
  const { data: tasks } = useSuspenseQuery(convexQuery(api.tasks.get, {}));
  const toggleTask = useMutation(api.tasks.toggle);
  const deleteTask = useMutation(api.tasks.remove);
  const createTask = useMutation(api.tasks.create);

  const [newTaskText, setNewTaskText] = useState("");

  const handleSignOut = useCallback(async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          location.reload();
        },
      },
    });
  }, []);

  const handleCreateTask = useCallback(async () => {
    if (!newTaskText.trim()) {
      return;
    }
    await createTask({ text: newTaskText });
    setNewTaskText("");
  }, [newTaskText, createTask]);

  const handleNewTaskTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewTaskText(e.target.value);
    },
    []
  );

  return (
    <div className="p-8 max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {user.name ?? user.email}
              </span>
              <Button variant="secondary" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => navigate({ to: "/login" })}>
              Sign In
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleCreateTask} className="flex gap-2">
        <Input
          value={newTaskText}
          onChange={handleNewTaskTextChange}
          placeholder="Add a new task..."
        />
        <Button type="submit">Add</Button>
      </form>

      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task._id}
            className="flex items-center justify-between p-3 border rounded-lg bg-card"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={task.isCompleted}
                onChange={() => toggleTask({ id: task._id })}
                className="w-4 h-4"
              />
              <span
                className={
                  task.isCompleted ? "line-through text-muted-foreground" : ""
                }
              >
                {task.text}
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteTask({ id: task._id })}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
