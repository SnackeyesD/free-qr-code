import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../services/auth.js";
import { getPublicTemplate, listPublicTemplates } from "../services/admin.js";
import { rateLimitMiddleware } from "../middlewares/rate-limit.js";
import type { AppEnv } from "../types/index.js";

export const templatesRoutes = new Hono<AppEnv>();

templatesRoutes.use(
  "*",
  authMiddleware as unknown as import("hono").MiddlewareHandler<AppEnv>,
);
templatesRoutes.use(
  "*",
  rateLimitMiddleware as unknown as import("hono").MiddlewareHandler<AppEnv>,
);

// Galerie des modèles publics : accessible à tout utilisateur connecté, sans
// droit admin. Les modèles privés ne quittent jamais cette route.
templatesRoutes.get("/publics", async (c) => {
  return c.json(await listPublicTemplates(c.env));
});

templatesRoutes.get("/publics/:publicId", async (c) => {
  const publicId = c.req.param("publicId");
  if (!publicId || publicId.length > 64) {
    throw new HTTPException(404, { message: "Modèle public non trouvé" });
  }
  return c.json(await getPublicTemplate(c.env, publicId));
});

export default templatesRoutes;
