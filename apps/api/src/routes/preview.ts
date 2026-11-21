import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { rateLimitMiddleware } from "../middlewares/rate-limit.js";
import { generateQRCodeImage } from "../lib/qr-generator.js";
import { previewQrSchema } from "../validators/qrcode.js";
import type { AppEnv } from "../types/index.js";

export const previewRoutes = new Hono<AppEnv>();

// Aperçu SVG avant création (utilisé par QRPreview côté web).
// Public (aucune donnée exposée, génération peu coûteuse) + rate-limit anti-abus.
previewRoutes.get(
  "/qr",
  rateLimitMiddleware as unknown as import("hono").MiddlewareHandler<AppEnv>,
  zValidator("query", previewQrSchema),
  async (c) => {
    const q = c.req.valid("query");
    const { buffer, mimeType } = await generateQRCodeImage(q.content, {
      couleur: q.couleur,
      background: q.background,
      taille: q.size,
      correction: q.correction,
      formatImage: "svg",
    });
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
);

export default previewRoutes;
