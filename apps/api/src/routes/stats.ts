import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../services/auth.js';
import { getQrCodeStats } from '../services/scan.js';
import { resolveQRCodeRow } from '../services/qrcode.js';
import type { AppEnv } from '../types/index.js';

export const statsRoutes = new Hono<AppEnv>();

const statsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

statsRoutes.get('/:id/stats', authMiddleware, zValidator('query', statsQuerySchema), async (c) => {
  const id = c.req.param('id');
  // Accepte l'id numérique comme le public_id (cf. resolveQRCodeRow).
  const qrCode = await resolveQRCodeRow(c.env, c.get('userId') as string, id);
  const qrCodeId = qrCode.id;

  const { from, to } = c.req.valid('query');
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : undefined;

  const stats = await getQrCodeStats(c.env, qrCodeId, fromDate, toDate);
  return c.json(stats);
});
