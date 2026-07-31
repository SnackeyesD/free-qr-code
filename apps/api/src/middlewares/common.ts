import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../types/index.js';

export function getCorsOrigin(env: AppEnv['Bindings'], reqOrigin?: string | null): string | null {
  const allowed = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  if (!reqOrigin) return null;
  if (allowed.includes('*') || allowed.includes(reqOrigin)) return reqOrigin;
  if (reqOrigin.startsWith('http://localhost:')) {
    if (allowed.some((o) => o.startsWith('http://localhost:'))) return reqOrigin;
  }
  return allowed[0] ?? null;
}

export async function corsMiddleware(c: Context<AppEnv>, next: import('hono').Next) {
  const origin = getCorsOrigin(c.env, c.req.header('origin'));
  if (origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Vary', 'Origin');
  }
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  c.header('Access-Control-Allow-Credentials', 'true');
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  await next();
}

export function errorHandler(err: Error, c: Context<AppEnv>) {
  const requestId = c.get('requestId') ?? 'unknown';
  console.error(`[${requestId}] error:`, err.message, err.stack);
  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: `HTTP_${err.status}`, message: err.message || 'Request error' }, requestId },
      err.status
    );
  }
  const message = c.env.API_BASE_URL?.startsWith('http://localhost') ? err.message : 'Internal server error';
  return c.json({ error: { code: 'INTERNAL_ERROR', message }, requestId }, 500);
}

export async function requestIdMiddleware(c: Context<AppEnv>, next: import('hono').Next) {
  const requestId = c.req.header('X-Request-ID') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
}
