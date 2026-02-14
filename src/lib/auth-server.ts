import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexSiteUrl: process.env.VITE_CONVEX_SITE_URL ?? "",
  convexUrl: process.env.VITE_CONVEX_URL ?? "",
});
