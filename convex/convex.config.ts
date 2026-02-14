import betterAuth from "@convex-dev/better-auth/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();

// oxlint-disable-next-line jest/require-hook
app.use(betterAuth);

export default app;
