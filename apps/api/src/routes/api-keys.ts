import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../services/auth.js';
import { createApiKey, getApiKeyById, listApiKeys, revokeApiKey } from '../services/api-keys.js';
import type { AppEnv } from '../types/index.js';

export const apiKeyRoutes = new Hono<AppEnv>();

apiKeyRoutes.use('*', authMiddleware as import('hono').MiddlewareHandler<AppEnv>);

const permissionSchema = z.enum([
  'qrcodes:read',
  'qrcodes:create',
  'qrcodes:update',
  'qrcodes:delete',
  'stats:read',
  'admin:campaigns',
  'admin:templates',
]);

const createApiKeySchema = z.object({
  nom: z.string().min(1).max(100).transform((v) => v.trim()),
  permissions: z.array(permissionSchema).optional(),
  dateExpiration: z.string().datetime().optional(),
});

apiKeyRoutes.get('/', async (c) => {
  const userId = Number(c.get('userId'));
  const keys = await listApiKeys(c.env, userId);
  return c.json({ data: keys });
});

apiKeyRoutes.post('/', zValidator('json', createApiKeySchema), async (c) => {
  const userId = Number(c.get('userId'));
  const input = c.req.valid('json');
  const key = await createApiKey(c.env, userId, {
    nom: input.nom,
    permissions: input.permissions,
    dateExpiration: input.dateExpiration,
  });
  return c.json(key, 201);
});

apiKeyRoutes.get('/:id', async (c) => {
  const userId = Number(c.get('userId'));
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid API key id' });
  }
  const key = await getApiKeyById(c.env, userId, id);
  if (!key) {
    throw new HTTPException(404, { message: 'API key not found' });
  }
  return c.json(key);
});

apiKeyRoutes.delete('/:id', async (c) => {
  const userId = Number(c.get('userId'));
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid API key id' });
  }
  const revoked = await revokeApiKey(c.env, userId, id);
  if (!revoked) {
    throw new HTTPException(404, { message: 'API key not found' });
  }
  return c.json({ success: true });
});
