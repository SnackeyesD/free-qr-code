import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVerifiedUser, makeRequest, createTestEnv, createTestApp } from './setup.js';

const app = createTestApp();

describe('User API', () => {
  let ctx: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  async function loginUser(email: string) {
    await createVerifiedUser(ctx.env, email, 'StrongPass123!', 'Test');
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email, motDePasse: 'StrongPass123!' },
    });
    const body = (await res.json()) as { accessToken: string };
    return body.accessToken;
  }

  function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('GET /me returns authenticated user profile', async () => {
    const token = await loginUser('meuser@example.com');
    const res = await makeRequest(app, ctx.env, 'GET', '/me', { headers: authHeaders(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { email: string; nom: string };
    expect(body.email).toBe('meuser@example.com');
    expect(body.nom).toBe('Test');
  });

  it('PATCH /me updates name and marketing consent', async () => {
    const token = await loginUser('patchuser@example.com');
    const res = await makeRequest(app, ctx.env, 'PATCH', '/me', {
      headers: authHeaders(token),
      body: { nom: 'Updated', consentementMarketing: true },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { nom: string; consentementMarketing: boolean };
    expect(body.nom).toBe('Updated');
    expect(body.consentementMarketing).toBe(true);
  });

  it('PATCH /me updates password with current password', async () => {
    const token = await loginUser('passuser@example.com');
    const res = await makeRequest(app, ctx.env, 'PATCH', '/me', {
      headers: authHeaders(token),
      body: { motDePasseActuel: 'StrongPass123!', nouveauMotDePasse: 'NewStrongPass123!' },
    });
    expect(res.status).toBe(200);
    const login = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'passuser@example.com', motDePasse: 'NewStrongPass123!' },
    });
    expect(login.status).toBe(200);
  });

  it('PATCH /me rejects password change with wrong current password', async () => {
    const token = await loginUser('wrongpassuser@example.com');
    const res = await makeRequest(app, ctx.env, 'PATCH', '/me', {
      headers: authHeaders(token),
      body: { motDePasseActuel: 'WrongPass', nouveauMotDePasse: 'NewStrongPass123!' },
    });
    expect(res.status).toBe(401);
  });

  it('GET /me/sessions lists active sessions', async () => {
    const token = await loginUser('sessionsuser@example.com');
    const res = await makeRequest(app, ctx.env, 'GET', '/me/sessions', { headers: authHeaders(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: number; userAgent: string | null; ip: string | null; createdAt: string; expiresAt: string }>;
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].userAgent).toBe('unknown');
  });

  it('DELETE /me/sessions/:id revokes a session', async () => {
    const token = await loginUser('revokesession@example.com');
    const list = await makeRequest(app, ctx.env, 'GET', '/me/sessions', { headers: authHeaders(token) });
    const sessions = (await list.json()) as Array<{ id: number }>;
    const res = await makeRequest(app, ctx.env, 'DELETE', `/me/sessions/${sessions[0].id}`, { headers: authHeaders(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('DELETE /me/sessions revokes all other sessions', async () => {
    const token = await loginUser('revokeall@example.com');
    const res = await makeRequest(app, ctx.env, 'DELETE', '/me/sessions', { headers: authHeaders(token) });
    expect(res.status).toBe(200);
    const list = await makeRequest(app, ctx.env, 'GET', '/me/sessions', { headers: authHeaders(token) });
    const sessions = (await list.json()) as Array<{ id: number }>;
    expect(sessions.length).toBe(1);
  });
});

export {};
