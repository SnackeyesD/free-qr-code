import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../types/index.js';

export const r2Routes = new Hono<AppEnv>();

// Sert les images QR stockées dans R2. Utilisé comme fallback quand
// R2_PUBLIC_URL n'est pas configuré (cf. getPublicR2Url).
r2Routes.get('/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const bucket = c.env.QR_IMAGES;
  if (!bucket) {
    throw new HTTPException(404, { message: 'Image storage not configured' });
  }
  const object = await bucket.get(key);
  if (!object || !('body' in object) || !object.body) {
    throw new HTTPException(404, { message: 'Image not found' });
  }
  const contentType =
    (object.httpMetadata?.contentType as string | undefined) ?? 'application/octet-stream';
  return new Response(object.body as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
});
