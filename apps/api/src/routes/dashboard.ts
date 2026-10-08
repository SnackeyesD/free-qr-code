import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, requireAdmin } from "../services/auth.js";
import {
  getAdminDashboardStats,
  getUserDashboardStats,
} from "../services/dashboard.js";
import type { AppEnv } from "../types/index.js";

export const dashboardRoutes = new Hono<AppEnv>();

// GET /dashboard (user dashboard stats)
dashboardRoutes.use(
  "*",
  authMiddleware as import("hono").MiddlewareHandler<AppEnv>,
);

dashboardRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  console.log("L'id", userId);
  if (!userId) {
    throw new HTTPException(401, { message: "Authentification requise" });
  }
  const stats = await getUserDashboardStats(c.env, userId);
  return c.json(stats);
});

// GET /admin/dashboard (admin dashboard stats)
export const adminDashboardRoutes = new Hono<AppEnv>();
adminDashboardRoutes.use(
  "*",
  authMiddleware as import("hono").MiddlewareHandler<AppEnv>,
);
adminDashboardRoutes.use(
  "*",
  requireAdmin as import("hono").MiddlewareHandler<AppEnv>,
);

adminDashboardRoutes.get("/", async (c) => {
  const stats = await getAdminDashboardStats(c.env);
  return c.json(stats);
});
