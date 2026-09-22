import { HTTPException } from 'hono/http-exception';
import type { AppContext } from '../types/index.js';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const inMemoryBuckets = new Map<string, RateLimitBucket>();

export function resetRateLimitBuckets(): void {
  inMemoryBuckets.clear();
}

export function parseRateLimitEnv(env: AppContext['env']) {
  return {
    windowSeconds: Math.max(1, parseInt(env.RATE_LIMIT_WINDOW_SECONDS, 10) || 60),
    maxRequests: Math.max(1, parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10) || 100),
  };
}

export function getClientIp(c: AppContext): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';
}

export function getRateLimitKey(c: AppContext): string {
  const ip = getClientIp(c);
  const userId = c.get('userId');
  const prefix = userId ? `user:${userId}` : `ip:${ip}`;
  return `${prefix}:${Math.floor(Date.now() / 1000 / parseRateLimitEnv(c.env).windowSeconds)}`;
}

async function checkInMemoryLimit(c: AppContext): Promise<boolean> {
  const { maxRequests, windowSeconds } = parseRateLimitEnv(c.env);
  const now = Math.floor(Date.now() / 1000);
  const key = getRateLimitKey(c);
  const bucket = inMemoryBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    inMemoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds });
    return true;
  }
  if (bucket.count < maxRequests) {
    bucket.count += 1;
    return true;
  }
  return false;
}

async function checkKvLimit(c: AppContext): Promise<boolean> {
  const kv = c.env.RATE_LIMIT_KV;
  if (!kv) return true; // fallback to in-memory below
  const { maxRequests, windowSeconds } = parseRateLimitEnv(c.env);
  const now = Math.floor(Date.now() / 1000);
  const key = getRateLimitKey(c);
  const bucketKey = `rl:${key}`;
  const stored = await kv.get(bucketKey, 'json') as RateLimitBucket | null;
  if (!stored || now > stored.resetAt) {
    await kv.put(bucketKey, JSON.stringify({ count: 1, resetAt: now + windowSeconds }), { expirationTtl: windowSeconds });
    return true;
  }
  if (stored.count < maxRequests) {
    await kv.put(bucketKey, JSON.stringify({ count: stored.count + 1, resetAt: stored.resetAt }), { expirationTtl: windowSeconds });
    return true;
  }
  return false;
}

export async function rateLimitMiddleware(c: AppContext, next: import('hono').Next) {
  const kv = c.env.RATE_LIMIT_KV;
  const allowed = kv ? await checkKvLimit(c) : await checkInMemoryLimit(c);
  if (!allowed) {
    const { windowSeconds } = parseRateLimitEnv(c.env);
    c.header('Retry-After', String(windowSeconds));
    throw new HTTPException(429, { message: 'Too many requests' });
  }
  await next();
}
