import { Hono } from 'hono';
import type { ScheduledEvent } from '@cloudflare/workers-types';
import { corsMiddleware, errorHandler, requestIdMiddleware } from './middlewares/common.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/user.js';
import { qrCodeRoutes } from './routes/qrcode.js';
import { redirectRoutes } from './routes/redirect.js';
import { statsRoutes } from './routes/stats.js';
import { adminRoutes, trackingRoutes } from './routes/admin.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { logRoutes } from './routes/logs.js';
import { r2Routes } from './routes/r2.js';
import { sendDueCampaigns } from './services/admin.js';
import type { AppEnv } from './types/index.js';

export const app = new Hono<AppEnv>();

app.use('*', requestIdMiddleware);
app.use('*', corsMiddleware);

app.onError(errorHandler);

app.get('/', (c) => c.json({ ok: true, service: 'free-qr-api' }));
app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/auth', authRoutes);
app.route('/qrcodes', qrCodeRoutes);
app.route('/qrcodes', statsRoutes);
app.route('/q', redirectRoutes);
app.route('/me', userRoutes);
app.route('/admin', adminRoutes);
app.route('/tracking', trackingRoutes);
app.route('/api-keys', apiKeyRoutes);
app.route('/logs', logRoutes);
app.route('/r2', r2Routes);

export default {
  fetch: (request: Request, env: AppEnv['Bindings'], ctx: ExecutionContext) =>
    app.fetch(request, env, ctx),
  async scheduled(_event: ScheduledEvent, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(
      sendDueCampaigns(env).catch((err: unknown) =>
        console.error('[scheduled] sendDueCampaigns failed:', err),
      ),
    );
  },
};
