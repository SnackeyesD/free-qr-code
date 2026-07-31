import type { Context } from 'hono';
import type { AppEnv } from '../types/index.js';

export type D1Bindings = { DB: AppEnv['Bindings']['DB'] };

export type D1BindValue = string | number | boolean | null;

export function getD1Database(env: AppEnv['Bindings']): AppEnv['Bindings']['DB'] {
  const db = env.DB;
  if (!db) {
    throw new Error('Missing D1 binding: env.DB is undefined');
  }
  return db;
}

export async function d1First<T = unknown>(
  env: AppEnv['Bindings'],
  query: string,
  ...params: D1BindValue[]
): Promise<T | null> {
  const db = getD1Database(env);
  const stmt = db.prepare(query).bind(...params);
  return stmt.first<T>();
}

export async function d1All<T = unknown>(
  env: AppEnv['Bindings'],
  query: string,
  ...params: D1BindValue[]
): Promise<T[]> {
  const db = getD1Database(env);
  const result = await db.prepare(query).bind(...params).all<T>();
  return Array.isArray(result) ? result : (result.results ?? []);
}

export async function d1Run(
  env: AppEnv['Bindings'],
  query: string,
  ...params: D1BindValue[]
): Promise<import('@cloudflare/workers-types').D1Result<never>> {
  const db = getD1Database(env);
  return db.prepare(query).bind(...params).run();
}

export async function d1Insert(
  env: AppEnv['Bindings'],
  query: string,
  ...params: D1BindValue[]
): Promise<number> {
  const result = await d1Run(env, query, ...params);
  return result.meta?.last_row_id ?? 0;
}

export type { Context };
