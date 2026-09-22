import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAdminUser, makeRequest, createTestEnv, createTestApp } from './setup.js';
import { sendDueCampaigns } from '../src/services/admin.js';

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

describe('Hardening P5', () => {
  let ctx: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('CORS ne plante pas sans CORS_ORIGINS et ne reflète rien', async () => {
    const env = { ...ctx.env, CORS_ORIGINS: '' as string };
    const res = await makeRequest(app, env, 'GET', '/health', {
      headers: { origin: 'https://evil.example.com' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('429 inclut Retry-After quand la limite est dépassée', async () => {
    const env = { ...ctx.env, RATE_LIMIT_WINDOW_SECONDS: '60', RATE_LIMIT_MAX_REQUESTS: '1' };
    const first = await makeRequest(app, env, 'POST', '/auth/login', {
      body: { email: 'x@example.com', motDePasse: 'y' },
    });
    expect(first.status).not.toBe(429);
    const second = await makeRequest(app, env, 'POST', '/auth/login', {
      body: { email: 'x@example.com', motDePasse: 'y' },
    });
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBe('60');
  });

  it('GET /tracking/click rejette les URL non-http(s)', async () => {
    const bad = await makeRequest(app, ctx.env, 'GET', '/tracking/click?t=tok&u=javascript:alert(1)');
    expect(bad.status).toBe(400);
    const relative = await makeRequest(app, ctx.env, 'GET', '/tracking/click?t=tok&u=/interne');
    expect(relative.status).toBe(400);
  });

  it('GET /r2/* 404 sans bucket ni objet', async () => {
    const res = await makeRequest(app, ctx.env, 'GET', '/r2/users/1/qrcodes/1.png');
    expect(res.status).toBe(404);
  });

  it('GET /r2/* sert le contenu R2 avec le bon Content-Type', async () => {
    const env = {
      ...ctx.env,
      QR_IMAGES: {
        get: async (key: string) =>
          key === 'users/1/qrcodes/1.png'
            ? { body: 'fake-bytes', httpMetadata: { contentType: 'image/png' } }
            : null,
      },
    } as unknown as typeof ctx.env;
    const res = await makeRequest(app, env, 'GET', '/r2/users/1/qrcodes/1.png');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(await res.text()).toBe('fake-bytes');

    const missing = await makeRequest(app, env, 'GET', '/r2/autre.png');
    expect(missing.status).toBe(404);
  });

  it('sendDueCampaigns envoie les campagnes programmées dues uniquement', async () => {
    const token = await adminToken(ctx);
    const mk = async (nom: string) => {
      const res = await makeRequest(app, ctx.env, 'POST', '/admin/campaigns', {
        headers: authHeaders(token),
        body: { nom, sujet: nom, corpsHtml: '<p>H</p>' },
      });
      return ((await res.json()) as { id: string }).id;
    };
    const dueId = await mk('Due');
    const futureId = await mk('Future');
    const draftId = await mk('Draft');
    ctx.db.prepare("UPDATE campagnes_emails SET statut = 'programmee', date_envoi = ? WHERE id = ?").run('2000-01-01T00:00:00.000Z', Number(dueId));
    ctx.db.prepare("UPDATE campagnes_emails SET statut = 'programmee', date_envoi = ? WHERE id = ?").run('2999-01-01T00:00:00.000Z', Number(futureId));

    const result = await sendDueCampaigns(ctx.env);
    expect(result.campaigns).toBe(1);

    const statut = (id: string) =>
      (ctx.db.prepare('SELECT statut FROM campagnes_emails WHERE id = ?').get(Number(id)) as { statut: string }).statut;
    expect(statut(dueId)).toBe('envoyee');
    expect(statut(futureId)).toBe('programmee');
    expect(statut(draftId)).toBe('brouillon');
  });
});

export {};
