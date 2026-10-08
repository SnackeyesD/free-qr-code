// src/routes/r2.ts
import { Hono } from "hono";
import { getQRImage } from "../services/r2Image";
import type { AppEnv } from "../types/index.js";

const r2Routes = new Hono<AppEnv>();

// dans ton fichier de routes r2
r2Routes.get("/users/:userId/qrcodes/:filename", async (c) => {
  const userId = c.req.param("userId");
  const filename = c.req.param("filename");

  const image = await getQRImage(c.env, userId, filename);
  const buffer = await new Response(image.body).arrayBuffer(); // si image.body est un stream

  return c.body(buffer, 200, {
    "Content-Type": image.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    ...(image.etag ? { ETag: image.etag } : {}),
  });
});
export default r2Routes;
