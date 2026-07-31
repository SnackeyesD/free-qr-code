import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { extractClientInfo, recordScan, resolveQrCodeByAlias } from '../services/scan.js';
import type { AppEnv } from '../types/index.js';

export const redirectRoutes = new Hono<AppEnv>();

redirectRoutes.get('/:aliasCourt', async (c) => {
  const aliasCourt = c.req.param('aliasCourt');
  const qrCode = await resolveQrCodeByAlias(c.env, aliasCourt);

  if (!qrCode) {
    throw new HTTPException(404, { message: 'QR code not found' });
  }

  if (!qrCode.estActif) {
    throw new HTTPException(404, { message: 'QR code inactive' });
  }

  if (qrCode.dateExpiration && new Date(qrCode.dateExpiration) < new Date()) {
    throw new HTTPException(410, { message: 'QR code expired' });
  }

  // Enregistrement asynchrone du scan sans bloquer la redirection.
  const clientInfo = extractClientInfo(c);
  c.executionCtx.waitUntil(recordScan(c.env, qrCode, clientInfo));

  return c.redirect(qrCode.contenu, 302);
});
