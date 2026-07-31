import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../services/auth.js';
import { rateLimitMiddleware } from '../middlewares/rate-limit.js';
import {
  createQRCode,
  listQRCodes,
  getQRCodeById,
  updateQRCode,
  deleteQRCode,
} from '../services/qrcode.js';
import { generateQRCodeImage } from '../lib/qr-generator.js';
import { createQRCodeSchema, updateQRCodeSchema, listQRCodesSchema, downloadQRCodeSchema } from '../validators/qrcode.js';
import type { AppEnv } from '../types/index.js';

export const qrCodeRoutes = new Hono<AppEnv>();

qrCodeRoutes.use('*', rateLimitMiddleware as unknown as import('hono').MiddlewareHandler<AppEnv>);
qrCodeRoutes.use('*', authMiddleware as unknown as import('hono').MiddlewareHandler<AppEnv>);

qrCodeRoutes.get('/', zValidator('query', listQRCodesSchema), async (c) => {
  const userId = c.get('userId') as string;
  const query = c.req.valid('query');
  const result = await listQRCodes(c.env, userId, query);
  return c.json(result);
});

qrCodeRoutes.post('/', zValidator('json', createQRCodeSchema), async (c) => {
  const userId = c.get('userId') as string;
  const input = c.req.valid('json');
  const qr = await createQRCode(c.env, userId, input);
  return c.json(qr, 201);
});

qrCodeRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const qr = await getQRCodeById(c.env, userId, id);
  return c.json(qr);
});

qrCodeRoutes.patch('/:id', zValidator('json', updateQRCodeSchema), async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const qr = await updateQRCode(c.env, userId, id, input);
  return c.json(qr);
});

qrCodeRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  await deleteQRCode(c.env, userId, id);
  return new Response(null, { status: 204 });
});

qrCodeRoutes.get('/:id/download', zValidator('query', downloadQRCodeSchema), async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const { format } = c.req.valid('query');
  const qr = await getQRCodeById(c.env, userId, id);

  const parametres = { ...qr.parametres, formatImage: format };
  const baseUrl = c.env.API_BASE_URL?.replace(/\/$/, '') ?? 'https://api.free-qrcode.app';
  const qrContent = qr.estDynamique && qr.aliasCourt
    ? `${baseUrl}/q/${qr.aliasCourt}`
    : qr.contenu;

  const { buffer, mimeType, extension } = await generateQRCodeImage(qrContent, parametres);
  const filename = `qr-${id}.${extension}`;

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
});

export default qrCodeRoutes;
