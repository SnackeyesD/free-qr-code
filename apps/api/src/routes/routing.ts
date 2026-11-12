import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { rateLimitMiddleware } from "../middlewares/rate-limit.js";
import { requirePermission } from "../middlewares/api-key-auth.js";
import {
  deleteRoutingConfig,
  getRoutingState,
  saveRoutingConfig,
  simulerRouting,
} from "../services/routing/service.js";
import {
  getRoutingStats,
  routingStatsToCsv,
} from "../services/routing/stats.js";
import { enregistrerConsultationStats } from "../services/routing/metrics.js";
import {
  routingConfigSchema,
  routingSimulationSchema,
} from "../validators/routing.js";
import type { AppEnv } from "../types/index.js";

export const routingRoutes = new Hono<AppEnv>();

type AppMiddleware = import("hono").MiddlewareHandler<AppEnv>;

routingRoutes.use(
  "*",
  rateLimitMiddleware as unknown as AppMiddleware,
);

const canRead = requirePermission("qrcodes:read") as unknown as AppMiddleware;
const canUpdate = requirePermission("qrcodes:update") as unknown as AppMiddleware;
const canStats = requirePermission("stats:read") as unknown as AppMiddleware;

const routingStatsQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : AAAA-MM-JJ")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : AAAA-MM-JJ")
    .optional(),
});

function periodeDepuisQuery(query: { from?: string; to?: string }) {
  return {
    from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
    to: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
  };
}

routingRoutes.get(
  "/:id/routage/stats",
  canStats,
  zValidator("query", routingStatsQuerySchema),
  async (c) => {
    const userId = c.get("userId") as string;
    const stats = await getRoutingStats(
      c.env,
      userId,
      c.req.param("id"),
      periodeDepuisQuery(c.req.valid("query")),
    );
    // Instrumentation non bloquante : mesure l'interet pour l'analytics payant.
    c.executionCtx.waitUntil(enregistrerConsultationStats(c.env, userId));
    return c.json(stats);
  },
);

routingRoutes.get(
  "/:id/routage/stats.csv",
  canStats,
  zValidator("query", routingStatsQuerySchema),
  async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const query = c.req.valid("query");
    const stats = await getRoutingStats(
      c.env,
      userId,
      id,
      periodeDepuisQuery(query),
    );

    const suffixe = [query.from ?? "debut", query.to ?? "fin"].join("_");
    return c.body(routingStatsToCsv(stats), 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="routage-${id}-${suffixe}.csv"`,
      "Cache-Control": "no-store",
    });
  },
);

routingRoutes.get("/:id/routage", canRead, async (c) => {
  const userId = c.get("userId") as string;
  const state = await getRoutingState(c.env, userId, c.req.param("id"));
  return c.json(state);
});

routingRoutes.put(
  "/:id/routage",
  canUpdate,
  zValidator("json", routingConfigSchema),
  async (c) => {
    const userId = c.get("userId") as string;
    const config = c.req.valid("json");
    const state = await saveRoutingConfig(
      c.env,
      userId,
      c.req.param("id"),
      config,
    );
    return c.json(state);
  },
);

routingRoutes.delete("/:id/routage", canUpdate, async (c) => {
  const userId = c.get("userId") as string;
  const state = await deleteRoutingConfig(c.env, userId, c.req.param("id"));
  return c.json(state);
});

routingRoutes.post(
  "/:id/routage/simuler",
  canRead,
  zValidator("json", routingSimulationSchema),
  async (c) => {
    const userId = c.get("userId") as string;
    const input = c.req.valid("json");
    const result = await simulerRouting(
      c.env,
      userId,
      c.req.param("id"),
      input,
    );
    return c.json(result);
  },
);
