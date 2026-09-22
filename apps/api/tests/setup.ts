import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { app } from '../src/index.js';
import { resetRateLimitBuckets } from '../src/middlewares/rate-limit.js';
import type { AppEnv } from '../src/types/index.js';
import type { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '@cloudflare/workers-types';

const baseEnv: Omit<AppEnv['Bindings'], 'DB'> = {
  JWT_ACCESS_SECRET: 'test-access-secret-min-32-bytes-!!',
  JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-bytes-!!',
  JWT_TRACKING_SECRET: 'test-tracking-secret-min-32-bytes-',
  API_BASE_URL: 'http://localhost:8787',
  CORS_ORIGINS: 'http://localhost:5173',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '7',
  RATE_LIMIT_WINDOW_SECONDS: '60',
  RATE_LIMIT_MAX_REQUESTS: '100',
};

const migrationsDir = path.resolve(__dirname, '../migrations');

function normalizeBindValue(value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

interface InternalPreparedStatement extends D1PreparedStatement {
  __sqliteStmt: any;
}

function createD1PreparedStatement(sqliteStmt: any): InternalPreparedStatement {
  const wrapper = {
    __sqliteStmt: sqliteStmt,

    bind(...values: unknown[]): D1PreparedStatement {
      const normalized = values.map(normalizeBindValue);
      return createD1PreparedStatement(sqliteStmt.bind(...normalized));
    },

    async first<T = unknown>(colName?: string): Promise<T | null> {
      try {
        if (colName !== undefined) {
          const row = sqliteStmt.get() as Record<string, unknown> | undefined;
          if (!row) return null;
          return (row[colName] as T) ?? null;
        }
        const row = sqliteStmt.get() as T | undefined;
        return row ?? null;
      } catch (err) {
        throw new Error(`D1 first error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },

    async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      try {
        const info = sqliteStmt.run();
        return {
          results: [],
          success: true,
          meta: {
            last_row_id: Number(info.lastInsertRowid) || 0,
            changes: Number(info.changes) || 0,
            changed_db: info.changes ? true : false,
            duration: 0,
            served_by: 'better-sqlite3',
            timings: {},
            size_after: 0,
            rows_read: 0,
            rows_written: info.changes || 0,
          },
        } as unknown as D1Result<T>;
      } catch (err) {
        throw new Error(`D1 run error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },

    async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      try {
        const rows = sqliteStmt.all() as T[];
        return {
          results: rows,
          success: true,
          meta: {
            last_row_id: 0,
            changes: 0,
            changed_db: false,
            duration: 0,
            served_by: 'better-sqlite3',
            timings: {},
            size_after: 0,
            rows_read: rows.length,
            rows_written: 0,
          },
        } as unknown as D1Result<T>;
      } catch (err) {
        throw new Error(`D1 all error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },

    async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<[string[], ...T[]] | T[]> {
      const rows = sqliteStmt.raw().all() as T[];
      if (options?.columnNames) {
        const columns = sqliteStmt.columns().map((c: any) => c.name);
        return [columns, ...rows];
      }
      return rows;
    },
  };
  return wrapper as InternalPreparedStatement;
}

function createD1Database(sqliteDb: any): D1Database {
  return {
    prepare(query: string): D1PreparedStatement {
      const stmt = sqliteDb.prepare(query);
      return createD1PreparedStatement(stmt);
    },

    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      const tx = sqliteDb.transaction(() => {
        for (const stmt of statements) {
          const info = (stmt as InternalPreparedStatement).__sqliteStmt.run();
          const result = {
            results: [],
            success: true,
            meta: {
              last_row_id: Number(info.lastInsertRowid) || 0,
              changes: Number(info.changes) || 0,
              changed_db: info.changes ? true : false,
              duration: 0,
              served_by: 'better-sqlite3',
              timings: {},
              size_after: 0,
              rows_read: 0,
              rows_written: info.changes || 0,
            },
          } as unknown as D1Result<T>;
          results.push(result);
        }
      });
      tx();
      return results;
    },

    async exec(query: string): Promise<D1ExecResult> {
      try {
        sqliteDb.exec(query);
        return { count: 0, duration: 0 };
      } catch (err) {
        throw new Error(`D1 exec error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },

    dump(): Promise<ArrayBuffer> {
      return Promise.resolve(new ArrayBuffer(0));
    },

    withSession() {
      return this;
    },
  } as any as D1Database;
}

export interface TestContext {
  env: AppEnv['Bindings'];
  dbFile: string;
  db: any;
  cleanup: () => void;
}

export function createTestEnv(): TestContext {
  const dbFile = path.join(os.tmpdir(), `free-qr-api-test-${crypto.randomUUID()}.db`);
  const db = Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Applique toutes les migrations dans l'ordre (comme wrangler avec migrations_dir).
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
  }

  const d1 = createD1Database(db);

  return {
    env: { ...baseEnv, DB: d1 as AppEnv['Bindings']['DB'] },
    dbFile,
    db,
    cleanup: () => {
      try {
        db.close();
      } catch {}
      for (const suffix of ['', '-wal', '-shm']) {
        try {
          fs.unlinkSync(`${dbFile}${suffix}`);
        } catch {}
      }
    },
  };
}

let userCounter = 0;

export async function createVerifiedUser(
  env: AppEnv['Bindings'],
  email: string,
  password: string,
  nom: string
): Promise<{ id: string; publicId: string; email: string; nom: string }> {
  userCounter++;
  const bcrypt = await import('bcryptjs');
  const now = new Date().toISOString();
  const publicId = crypto.randomUUID();
  const hashed = await bcrypt.hash(password, 10);
  const stmt = env.DB.prepare(
    `INSERT INTO utilisateurs (
      public_id, email, mot_de_passe, nom, est_verifie, consentement_marketing,
      date_consentement_marketing, date_inscription, est_actif, role
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = await stmt
    .bind(publicId, email.toLowerCase().trim(), hashed, nom.trim(), 1, 0, null, now, 1, 'utilisateur')
    .run();
  const id = result.meta?.last_row_id ?? userCounter;
  return { id: String(id), publicId, email: email.toLowerCase().trim(), nom: nom.trim() };
}

export async function createAdminUser(
  env: AppEnv['Bindings'],
  email: string,
  password: string,
  nom: string
): Promise<{ id: string; publicId: string; email: string; nom: string }> {
  userCounter++;
  const bcrypt = await import('bcryptjs');
  const now = new Date().toISOString();
  const publicId = crypto.randomUUID();
  const hashed = await bcrypt.hash(password, 10);
  const stmt = env.DB.prepare(
    `INSERT INTO utilisateurs (
      public_id, email, mot_de_passe, nom, est_verifie, consentement_marketing,
      date_consentement_marketing, date_inscription, est_actif, role
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = await stmt
    .bind(publicId, email.toLowerCase().trim(), hashed, nom.trim(), 1, 0, null, now, 1, 'admin')
    .run();
  const id = result.meta?.last_row_id ?? userCounter;
  return { id: String(id), publicId, email: email.toLowerCase().trim(), nom: nom.trim() };
}

export async function makeRequest(
  app: Hono<AppEnv>,
  env: AppEnv['Bindings'],
  method: string,
  path: string,
  options: { headers?: Record<string, string>; body?: unknown; cookies?: string } = {}
): Promise<Response> {
  const url = new URL(path, env.API_BASE_URL);
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    } as Record<string, string>,
  };
  if (options.cookies) {
    (init.headers as Record<string, string>)['Cookie'] = options.cookies;
  }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  return app.fetch(
    new Request(url.toString(), init),
    env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as any
  );
}

export function createTestApp(): Hono<AppEnv> {
  return app;
}

beforeAll(() => {});
afterAll(() => {});
beforeEach(() => {
  resetRateLimitBuckets();
});
afterEach(() => {
  resetRateLimitBuckets();
});
