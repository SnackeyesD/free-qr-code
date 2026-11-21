import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { genererVCard } from "../lib/vcard.js";
import { rateLimitMiddleware } from "../middlewares/rate-limit.js";
import { getFichePublique } from "../services/fiche.js";
import type { AppEnv } from "../types/index.js";

export const fichePubliqueRoutes = new Hono<AppEnv>();

fichePubliqueRoutes.use(
  "*",
  rateLimitMiddleware as unknown as import("hono").MiddlewareHandler<AppEnv>,
);

fichePubliqueRoutes.get("/:publicId/vcf", async (c) => {
  const fiche = await getFichePublique(c.env, c.req.param("publicId"));
  if (fiche.schema.nature !== "carte") {
    throw new HTTPException(404, {
      message: "Cette fiche n'est pas une carte de visite",
    });
  }

  const vcard = genererVCard(fiche);
  return new Response(vcard.contenu, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${vcard.nomFichier}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

fichePubliqueRoutes.get("/:publicId", async (c) => {
  const fiche = await getFichePublique(c.env, c.req.param("publicId"));
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  return c.json(fiche);
});

export default fichePubliqueRoutes;
