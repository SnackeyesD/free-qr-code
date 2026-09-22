import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAdminUser, createVerifiedUser, makeRequest, createTestEnv, createTestApp } from './setup.js';

const app = createTestApp();

async function adminAuth(ctx: ReturnType<typeof createTestEnv>) {
  await createAdminUser(ctx.env, 'admin@example.com', 'AdminPass123!', 'Admin');
  const login = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
    body: { email: 'admin@example.com', motDePasse: 'AdminPass123!' },
  });
  expect(login.status).toBe(200);
  const body = (await login.json()) as { accessToken: string; user: { id: string } };
  return { token: body.accessToken, adminId: body.user.id };
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('Admin users', () => {
  let ctx: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('GET /admin/users exige le rôle admin (403 sinon)', async () => {
    await createVerifiedUser(ctx.env, 'user@example.com', 'UserPass123!', 'User');
    const login = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'user@example.com', motDePasse: 'UserPass123!' },
    });
    const { accessToken } = (await login.json()) as { accessToken: string };

    const res = await makeRequest(app, ctx.env, 'GET', '/admin/users', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(403);
  });

  it('GET /admin/users liste paginée avec total', async () => {
    const { token } = await adminAuth(ctx);
    await createVerifiedUser(ctx.env, 'a@example.com', 'UserPass123!', 'A');
    await createVerifiedUser(ctx.env, 'b@example.com', 'UserPass123!', 'B');

    const res = await makeRequest(app, ctx.env, 'GET', '/admin/users?page=1&limit=2', {
      headers: authHeaders(token),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ email: string; estActif: boolean }>; total: number };
    expect(body.total).toBe(3);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toHaveProperty('estActif');
  });

  it('GET /admin/users filtre par search et role', async () => {
    const { token } = await adminAuth(ctx);
    await createVerifiedUser(ctx.env, 'searchme@example.com', 'UserPass123!', 'SearchMe');

    const search = await makeRequest(app, ctx.env, 'GET', '/admin/users?search=searchme', {
      headers: authHeaders(token),
    });
    const searchBody = (await search.json()) as { data: Array<{ email: string }>; total: number };
    expect(searchBody.total).toBe(1);
    expect(searchBody.data[0]?.email).toBe('searchme@example.com');

    const role = await makeRequest(app, ctx.env, 'GET', '/admin/users?role=admin', {
      headers: authHeaders(token),
    });
    const roleBody = (await role.json()) as { data: Array<{ email: string }>; total: number };
    expect(roleBody.total).toBe(1);
    expect(roleBody.data[0]?.email).toBe('admin@example.com');
  });

  it('PATCH /admin/users/:id modifie estActif et role', async () => {
    const { token } = await adminAuth(ctx);
    const user = await createVerifiedUser(ctx.env, 'target@example.com', 'UserPass123!', 'Target');

    const patch = await makeRequest(app, ctx.env, 'PATCH', `/admin/users/${user.id}`, {
      headers: authHeaders(token),
      body: { estActif: false, role: 'admin' },
    });
    expect(patch.status).toBe(200);
    const body = (await patch.json()) as { estActif: boolean; role: string };
    expect(body.estActif).toBe(false);
    expect(body.role).toBe('admin');
  });

  it('PATCH /admin/users/:id refuse de modifier son propre compte (403)', async () => {
    const { token, adminId } = await adminAuth(ctx);
    const res = await makeRequest(app, ctx.env, 'PATCH', `/admin/users/${adminId}`, {
      headers: authHeaders(token),
      body: { estActif: false },
    });
    expect(res.status).toBe(403);
  });

  it('PATCH /admin/users/:id 404 sur inconnu, 400 sur body vide', async () => {
    const { token } = await adminAuth(ctx);
    const missing = await makeRequest(app, ctx.env, 'PATCH', '/admin/users/9999', {
      headers: authHeaders(token),
      body: { estActif: false },
    });
    expect(missing.status).toBe(404);

    const empty = await makeRequest(app, ctx.env, 'PATCH', '/admin/users/1', {
      headers: authHeaders(token),
      body: {},
    });
    expect(empty.status).toBe(400);
  });

  it('DELETE /admin/users/:id supprime, sauf soi-même (403)', async () => {
    const { token, adminId } = await adminAuth(ctx);
    const user = await createVerifiedUser(ctx.env, 'gone@example.com', 'UserPass123!', 'Gone');

    const del = await makeRequest(app, ctx.env, 'DELETE', `/admin/users/${user.id}`, {
      headers: authHeaders(token),
    });
    expect(del.status).toBe(200);

    const again = await makeRequest(app, ctx.env, 'DELETE', `/admin/users/${user.id}`, {
      headers: authHeaders(token),
    });
    expect(again.status).toBe(404);

    const self = await makeRequest(app, ctx.env, 'DELETE', `/admin/users/${adminId}`, {
      headers: authHeaders(token),
    });
    expect(self.status).toBe(403);
  });
});

export {};
