import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware, requireAdmin } from '../services/auth.js';
import {
  cancelCampaign,
  createCampaign,
  createTemplate,
  deleteCampaign,
  deleteTemplate,
  getCampaignById,
  getTemplateById,
  listCampaigns,
  listTemplates,
  recordTrackingEvent,
  sendCampaign,
  transparent1x1Gif,
  updateCampaign,
  updateTemplate,
} from '../services/admin.js';
import { deleteUser, getUserById, listUsers, updateUser } from '../services/users.js';
import {
  createCampaignSchema,
  createTemplateSchema,
  listCampaignsSchema,
  listTemplatesSchema,
  listUsersSchema,
  sendCampaignSchema,
  updateCampaignSchema,
  updateTemplateSchema,
  updateUserSchema,
} from '../validators/admin.js';
import type { AppEnv } from '../types/index.js';
import type { CibleCampagneEmail } from '../validators/admin.js';

import type { CreateCampaignInput as CreateCampaignInputService, CreateTemplateInput as CreateTemplateInputService } from '../services/admin.js';

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', authMiddleware as import('hono').MiddlewareHandler<AppEnv>);
adminRoutes.use('*', requireAdmin as import('hono').MiddlewareHandler<AppEnv>);

adminRoutes.get('/campaigns', zValidator('query', listCampaignsSchema), async (c) => {
  const result = await listCampaigns(c.env, c.req.valid('query'));
  return c.json(result);
});

adminRoutes.post('/campaigns', zValidator('json', createCampaignSchema), async (c) => {
  const userId = Number(c.get('userId'));
  const input = c.req.valid('json');
  const campaign = await createCampaign(c.env, userId, input as CreateCampaignInputService);
  return c.json(campaign, 201);
});

adminRoutes.get('/campaigns/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const campaign = await getCampaignById(c.env, id);
  return c.json(campaign);
});

adminRoutes.patch('/campaigns/:id', zValidator('json', updateCampaignSchema), async (c) => {
  const id = Number(c.req.param('id'));
  const input = c.req.valid('json');
  const campaign = await updateCampaign(c.env, id, input);
  return c.json(campaign);
});

adminRoutes.post('/campaigns/:id/send', zValidator('json', sendCampaignSchema), async (c) => {
  const id = Number(c.req.param('id'));
  const input = c.req.valid('json');
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
  const result = await sendCampaign(c.env, id, scheduledAt);
  return c.json(result, 202);
});

adminRoutes.delete('/campaigns/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid campaign id' });
  }
  await deleteCampaign(c.env, id);
  return new Response(null, { status: 204 });
});

adminRoutes.post('/campaigns/:id/cancel', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid campaign id' });
  }
  const campaign = await cancelCampaign(c.env, id);
  return c.json(campaign);
});

adminRoutes.get('/templates', zValidator('query', listTemplatesSchema), async (c) => {
  const result = await listTemplates(c.env, c.req.valid('query'));
  return c.json(result);
});

adminRoutes.post('/templates', zValidator('json', createTemplateSchema), async (c) => {
  const userId = Number(c.get('userId'));
  const input = c.req.valid('json');
  const template = await createTemplate(c.env, userId, input as CreateTemplateInputService);
  return c.json(template, 201);
});

adminRoutes.get('/templates/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const template = await getTemplateById(c.env, id);
  return c.json(template);
});

adminRoutes.patch('/templates/:id', zValidator('json', updateTemplateSchema), async (c) => {
  const id = Number(c.req.param('id'));
  const input = c.req.valid('json');
  const template = await updateTemplate(c.env, id, input);
  return c.json(template);
});

adminRoutes.delete('/templates/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await deleteTemplate(c.env, id);
  return new Response(null, { status: 204 });
});

adminRoutes.get('/users', zValidator('query', listUsersSchema), async (c) => {
  const result = await listUsers(c.env, c.req.valid('query'));
  return c.json(result);
});

adminRoutes.get('/users/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid user id' });
  }
  return c.json(await getUserById(c.env, id));
});

adminRoutes.patch('/users/:id', zValidator('json', updateUserSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid user id' });
  }
  if (id === Number(c.get('userId'))) {
    throw new HTTPException(403, { message: 'Cannot modify your own account' });
  }
  const user = await updateUser(c.env, id, c.req.valid('json'));
  return c.json(user);
});

adminRoutes.delete('/users/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid user id' });
  }
  if (id === Number(c.get('userId'))) {
    throw new HTTPException(403, { message: 'Cannot delete your own account' });
  }
  const deleted = await deleteUser(c.env, id);
  if (!deleted) {
    throw new HTTPException(404, { message: 'Utilisateur non trouvé' });
  }
  return c.json({ success: true });
});

export const trackingRoutes = new Hono<AppEnv>();

trackingRoutes.get('/pixel', async (c) => {
  const token = c.req.query('t');
  if (!token) throw new HTTPException(400, { message: 'Token manquant' });
  await recordTrackingEvent(c.env, token, 'ouverture', {
    userAgent: c.req.header('User-Agent') ?? 'unknown',
    ip: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown',
  });
  const gif = transparent1x1Gif();
  return c.body(gif, 200, { 'Content-Type': 'image/gif', 'Content-Length': String(gif.byteLength) });
});

trackingRoutes.get('/click', async (c) => {
  const token = c.req.query('t');
  const url = c.req.query('u');
  if (!token) throw new HTTPException(400, { message: 'Token manquant' });
  if (!url) throw new HTTPException(400, { message: 'URL cible manquante' });
  // Anti open-redirect : seules les URLs http(s) absolues sont autorisées.
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new HTTPException(400, { message: 'URL cible invalide' });
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new HTTPException(400, { message: 'URL cible invalide' });
  }
  await recordTrackingEvent(c.env, token, 'clic', {
    urlCible: target.toString(),
    userAgent: c.req.header('User-Agent') ?? 'unknown',
    ip: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown',
  });
  return c.redirect(target.toString(), 302);
});
