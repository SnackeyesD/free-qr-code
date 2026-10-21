// src/routes/r2.ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getQRImage } from "../services/r2Image";
import { verifyR2Signature } from "../lib/r2-signed-url.js";
import type { AppEnv } from "../types/index.js";

const r2Routes = new Hono<AppEnv>();

// Les images ne sont servies que via une URL signée (query ?exp=&sig=)
// générée par l'API à la lecture d'un QR code. Toute URL non signée ou
// expirée est refusée : plus d'accès direct par URL devinée.
r2Routes.get("/users/:userId/qrcodes/:filename", async (c) => {
  const userId = c.req.param("userId");
  const filename = c.req.param("filename");
  const key = `users/${userId}/qrcodes/${filename}`;

  const isValid = await verifyR2Signature(
    c.env,
    key,
    c.req.query("exp"),
    c.req.query("sig"),
  );
  if (!isValid) {
    throw new HTTPException(403, {
      message: "Invalid or expired image URL signature",
    });
  }

  const image = await getQRImage(c.env, userId, filename);
  const buffer = await new Response(image.body).arrayBuffer(); // si image.body est un stream

  return c.body(buffer, 200, {
    "Content-Type": image.contentType,
    "Cache-Control": "private, max-age=3600",
    ...(image.etag ? { ETag: image.etag } : {}),
  });
});
export default r2Routes;
