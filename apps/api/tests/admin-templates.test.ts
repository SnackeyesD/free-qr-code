import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAdminUser, makeRequest, createTestEnv, createTestApp } from './setup.js';

const app = createTestApp();

async function adminToken(ctx: ReturnType<typeof createTestEnv>) {
  await createAdminUser(ctx.env, 'admin@example.com', 'AdminPass123!', 'Admin');
  const login = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
    body: { email: 'admin@example.com', motDePasse: 'AdminPass123!' },
  });
  const body = (await login.json()) as { accessToken: string };
  return body.accessToken;
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createTemplate(ctx: ReturnType<typeof createTestEnv>, token: string, nom: string) {
  const res = await makeRequest(app, ctx.env, 'POST', '/admin/templates', {
    headers: authHeaders(token),
    body: { nom, description: `Desc ${nom}`, typeContenu: 'url', estPublic: true },
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
}

describe('Admin templates', () => {
  let ctx: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('GET /admin/templates pagine et filtre par search', async () => {
    const token = await adminToken(ctx);
    await createTemplate(ctx, token, 'Menu');
    await createTemplate(ctx, token, 'Carte');

    const page = await makeRequest(app, ctx.env, 'GET', '/admin/templates?page=2&limit=1', {
      headers: authHeaders(token),
    });
    const pageBody = (await page.json()) as { data: unknown[]; total: number };
    expect(page.status).toBe(200);
    expect(pageBody.total).toBe(2);
    expect(pageBody.data).toHaveLength(1);

    const search = await makeRequest(app, ctx.env, 'GET', '/admin/templates?search=Menu', {
      headers: authHeaders(token),
    });
    const searchBody = (await search.json()) as { data: Array<{ nom: string }>; total: number };
    expect(searchBody.total).toBe(1);
    expect(searchBody.data[0]?.nom).toBe('Menu');
  });
});

export {};
