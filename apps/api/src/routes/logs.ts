import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../services/auth.js';
import { createQRCodeLog, listQRCodeLogs, assertQRCodeOwner } from '../services/logs.js';
import type { AppEnv } from '../types/index.js';

export const logRoutes = new Hono<AppEnv>();

logRoutes.use('*', authMiddleware as import('hono').MiddlewareHandler<AppEnv>);

const actionSchema = z.enum([
  'modification_cible',
  'activation',
  'desactivation',
  'suppression',
]);

const createLogSchema = z.object({
  idQRCode: z.number().int().positive(),
  action: actionSchema,
  ancienneValeur: z.record(z.unknown()).optional(),
  nouvelleValeur: z.record(z.unknown()).optional(),
});

const listLogsQuerySchema = z.object({
  idQRCode: z.string().regex(/^\d+$/).transform(Number),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
});

logRoutes.get('/', zValidator('query', listLogsQuerySchema), async (c) => {
  const userId = Number(c.get('userId'));
  const { idQRCode, limit, offset } = c.req.valid('query');
  await assertQRCodeOwner(c.env, idQRCode, userId);
  const result = await listQRCodeLogs(c.env, idQRCode, { limit, offset });
  return c.json(result);
});

logRoutes.post('/', zValidator('json', createLogSchema), async (c) => {
  const userId = Number(c.get('userId'));
  const input = c.req.valid('json');
  await assertQRCodeOwner(c.env, input.idQRCode, userId);
  const log = await createQRCodeLog(c.env, {
    idQRCode: input.idQRCode,
    idUtilisateur: userId,
    action: input.action,
    ancienneValeur: input.ancienneValeur,
    nouvelleValeur: input.nouvelleValeur,
  });
  return c.json(log, 201);
});
