import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../services/auth.js";
import {
  createFiche,
  createFicheModele,
  deleteFiche,
  deleteFicheModele,
  getFicheById,
  getFicheModeleById,
  listFiches,
  listFichesModeles,
  updateFiche,
  updateFicheModele,
} from "../services/fiche.js";
import {
  createFicheModeleSchema,
  createFicheSchema,
  listFichesSchema,
  updateFicheModeleSchema,
  updateFicheSchema,
} from "../validators/fiche.js";
import type { AppEnv } from "../types/index.js";

export const ficheRoutes = new Hono<AppEnv>();

ficheRoutes.use(
  "*",
  authMiddleware as unknown as import("hono").MiddlewareHandler<AppEnv>,
);

// Les modèles doivent être déclarés AVANT /:id pour ne pas être capturés.
ficheRoutes.get("/modeles", async (c) => {
  const userId = c.get("userId") as string;
  return c.json(await listFichesModeles(c.env, userId));
});

ficheRoutes.post(
  "/modeles",
  zValidator("json", createFicheModeleSchema),
  async (c) => {
    const userId = c.get("userId") as string;
    const modele = await createFicheModele(c.env, userId, c.req.valid("json"));
    return c.json(modele, 201);
  },
);

ficheRoutes.get("/modeles/:id", async (c) => {
  const userId = c.get("userId") as string;
  return c.json(await getFicheModeleById(c.env, userId, c.req.param("id")));
});

ficheRoutes.patch(
  "/modeles/:id",
  zValidator("json", updateFicheModeleSchema),
  async (c) => {
    const userId = c.get("userId") as string;
    const modele = await updateFicheModele(
      c.env,
      userId,
      c.req.param("id"),
      c.req.valid("json"),
    );
    return c.json(modele);
  },
);

ficheRoutes.delete("/modeles/:id", async (c) => {
  const userId = c.get("userId") as string;
  await deleteFicheModele(c.env, userId, c.req.param("id"));
  return new Response(null, { status: 204 });
});

ficheRoutes.get("/", zValidator("query", listFichesSchema), async (c) => {
  const userId = c.get("userId") as string;
  return c.json(await listFiches(c.env, userId, c.req.valid("query")));
});

ficheRoutes.post("/", zValidator("json", createFicheSchema), async (c) => {
  const userId = c.get("userId") as string;
  const fiche = await createFiche(c.env, userId, c.req.valid("json"));
  return c.json(fiche, 201);
});

ficheRoutes.get("/:id", async (c) => {
  const userId = c.get("userId") as string;
  return c.json(await getFicheById(c.env, userId, c.req.param("id")));
});

ficheRoutes.patch(
  "/:id",
  zValidator("json", updateFicheSchema),
  async (c) => {
    const userId = c.get("userId") as string;
    const fiche = await updateFiche(
      c.env,
      userId,
      c.req.param("id"),
      c.req.valid("json"),
    );
    return c.json(fiche);
  },
);

ficheRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  await deleteFiche(c.env, userId, c.req.param("id"));
  return new Response(null, { status: 204 });
});

export default ficheRoutes;
