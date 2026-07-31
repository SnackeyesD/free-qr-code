import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { d1First } from '../lib/db.js';
import { authMiddleware } from '../services/auth.js';
import { getQrCodeStats } from '../services/scan.js';
import type { AppEnv } from '../types/index.js';
import type { QRCodeDoc } from '../types/index.js';

export const statsRoutes = new Hono<AppEnv>();

const statsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

statsRoutes.get('/:id/stats', authMiddleware, zValidator('query', statsQuerySchema), async (c) => {
  const id = c.req.param('id');
  if (!id || !/^\d+$/.test(id)) {
    throw new HTTPException(400, { message: 'Invalid QR code id' });
  }
  const qrCodeId = Number.parseInt(id, 10);

  const qrCode = await d1First<QRCodeDoc>(
    c.env,
    `SELECT id, public_id, id_utilisateur AS idUtilisateur, contenu, type_contenu AS typeContenu,
            est_dynamique AS estDynamique, alias_court AS aliasCourt, parametres,
            est_actif AS estActif, date_creation AS dateCreation, date_expiration AS dateExpiration,
            nombre_scans_total AS nombreScansTotal, url_image AS urlImage, id_modele AS idModele
     FROM qrcodes
     WHERE id = ?`,
    qrCodeId
  );

  if (!qrCode) {
    throw new HTTPException(404, { message: 'QR code not found' });
  }

  if (String(qrCode.idUtilisateur) !== c.get('userId')) {
    throw new HTTPException(403, { message: 'Access denied' });
  }

  const { from, to } = c.req.valid('query');
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : undefined;

  const stats = await getQrCodeStats(c.env, qrCodeId, fromDate, toDate);
  return c.json(stats);
});
