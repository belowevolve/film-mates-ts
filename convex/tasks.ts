import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const get = query({
  args: {},
  handler: (context) => context.db.query("tasks").collect(),
});

export const toggle = mutation({
  args: { id: v.id("tasks") },
  handler: async (context, arguments_) => {
    const task = await context.db.get(arguments_.id);
    if (!task) {
      throw new Error("Task not found");
    }
    await context.db.patch(arguments_.id, { isCompleted: !task.isCompleted });
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (context, arguments_) => {
    await context.db.delete(arguments_.id);
  },
});

export const create = mutation({
  args: { text: v.string() },
  handler: async (context, arguments_) => {
    await context.db.insert("tasks", {
      isCompleted: false,
      text: arguments_.text,
    });
  },
});
