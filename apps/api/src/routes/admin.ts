import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware, requireAdmin } from '../services/auth.js';
import {
  createCampaign,
  createTemplate,
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
import {
  createCampaignSchema,
  createTemplateSchema,
  sendCampaignSchema,
  updateCampaignSchema,
  updateTemplateSchema,
} from '../validators/admin.js';
import type { AppEnv } from '../types/index.js';
import type { CibleCampagneEmail } from '../validators/admin.js';

import type { CreateCampaignInput as CreateCampaignInputService, CreateTemplateInput as CreateTemplateInputService } from '../services/admin.js';

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', authMiddleware as import('hono').MiddlewareHandler<AppEnv>);
adminRoutes.use('*', requireAdmin as import('hono').MiddlewareHandler<AppEnv>);

adminRoutes.get('/campaigns', async (c) => {
  const result = await listCampaigns(c.env);
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

adminRoutes.get('/templates', async (c) => {
  const result = await listTemplates(c.env);
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
  await recordTrackingEvent(c.env, token, 'clic', {
    urlCible: url,
    userAgent: c.req.header('User-Agent') ?? 'unknown',
    ip: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown',
  });
  return c.redirect(url, 302);
});
