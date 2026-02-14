import { httpRouter } from "convex/server";

import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// oxlint-disable-next-line jest/require-hook
authComponent.registerRoutes(http, createAuth);

export default http;
