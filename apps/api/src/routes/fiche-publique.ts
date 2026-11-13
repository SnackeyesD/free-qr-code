import { Hono } from "hono";
import { rateLimitMiddleware } from "../middlewares/rate-limit.js";
import { getFichePublique } from "../services/fiche.js";
import type { AppEnv } from "../types/index.js";

export const fichePubliqueRoutes = new Hono<AppEnv>();

fichePubliqueRoutes.use(
  "*",
  rateLimitMiddleware as unknown as import("hono").MiddlewareHandler<AppEnv>,
);

fichePubliqueRoutes.get("/:publicId", async (c) => {
  const fiche = await getFichePublique(c.env, c.req.param("publicId"));
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  return c.json(fiche);
});

export default fichePubliqueRoutes;
