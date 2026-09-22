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

async function createCampaign(ctx: ReturnType<typeof createTestEnv>, token: string, nom: string) {
  const res = await makeRequest(app, ctx.env, 'POST', '/admin/campaigns', {
    headers: authHeaders(token),
    body: { nom, sujet: `Sujet ${nom}`, corpsHtml: '<p>Hello</p>' },
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
}

describe('Admin campaigns lifecycle', () => {
  let ctx: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('GET /admin/campaigns pagine et filtre par statut/search', async () => {
    const token = await adminToken(ctx);
    await createCampaign(ctx, token, 'Alpha');
    await createCampaign(ctx, token, 'Beta');

    const page = await makeRequest(app, ctx.env, 'GET', '/admin/campaigns?page=2&limit=1', {
      headers: authHeaders(token),
    });
    const pageBody = (await page.json()) as { data: unknown[]; total: number };
    expect(page.status).toBe(200);
    expect(pageBody.total).toBe(2);
    expect(pageBody.data).toHaveLength(1);

    const search = await makeRequest(app, ctx.env, 'GET', '/admin/campaigns?search=Alpha', {
      headers: authHeaders(token),
    });
    const searchBody = (await search.json()) as { data: Array<{ nom: string }>; total: number };
    expect(searchBody.total).toBe(1);
    expect(searchBody.data[0]?.nom).toBe('Alpha');

    const statut = await makeRequest(app, ctx.env, 'GET', '/admin/campaigns?statut=brouillon', {
      headers: authHeaders(token),
    });
    expect(((await statut.json()) as { total: number }).total).toBe(2);
  });

  it('DELETE /admin/campaigns/:id supprime un brouillon (204)', async () => {
    const token = await adminToken(ctx);
    const campaign = await createCampaign(ctx, token, 'ToDelete');

    const del = await makeRequest(app, ctx.env, 'DELETE', `/admin/campaigns/${campaign.id}`, {
      headers: authHeaders(token),
    });
    expect(del.status).toBe(204);

    const get = await makeRequest(app, ctx.env, 'GET', `/admin/campaigns/${campaign.id}`, {
      headers: authHeaders(token),
    });
    expect(get.status).toBe(404);
  });

  it('POST /admin/campaigns/:id/cancel annule un brouillon', async () => {
    const token = await adminToken(ctx);
    const campaign = await createCampaign(ctx, token, 'ToCancel');

    const cancel = await makeRequest(app, ctx.env, 'POST', `/admin/campaigns/${campaign.id}/cancel`, {
      headers: authHeaders(token),
    });
    expect(cancel.status).toBe(200);
    expect(((await cancel.json()) as { statut: string }).statut).toBe('annulee');
  });

  it('POST /admin/campaigns persiste nom, sujet et corps_texte distincts', async () => {
    const token = await adminToken(ctx);
    const res = await makeRequest(app, ctx.env, 'POST', '/admin/campaigns', {
      headers: authHeaders(token),
      body: { nom: 'Interne promo', sujet: 'Sujet public', corpsHtml: '<p>Html</p>', corpsTexte: 'Texte brut' },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; nom: string; sujet: string; corpsTexte?: string };
    expect(body.nom).toBe('Interne promo');
    expect(body.sujet).toBe('Sujet public');
    expect(body.corpsTexte).toBe('Texte brut');

    const row = ctx.db.prepare('SELECT nom, titre, corps_texte FROM campagnes_emails WHERE id = ?').get(Number(body.id)) as {
      nom: string;
      titre: string;
      corps_texte: string;
    };
    expect(row.nom).toBe('Interne promo');
    expect(row.titre).toBe('Sujet public');
    expect(row.corps_texte).toBe('Texte brut');
  });

  it('POST /admin/campaigns accepte la cible consentants (CHECK migration 003)', async () => {
    const token = await adminToken(ctx);
    const res = await makeRequest(app, ctx.env, 'POST', '/admin/campaigns', {
      headers: authHeaders(token),
      body: { nom: 'C', sujet: 'S', corpsHtml: '<p>H</p>', cible: 'consentants' },
    });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { cible: string }).cible).toBe('consentants');
  });

  it('DELETE refuse une campagne envoyée, cancel refuse une campagne envoyée', async () => {
    const token = await adminToken(ctx);
    const campaign = await createCampaign(ctx, token, 'Sent');
    ctx.db.prepare("UPDATE campagnes_emails SET statut = 'envoyee' WHERE id = ?").run(Number(campaign.id));

    const del = await makeRequest(app, ctx.env, 'DELETE', `/admin/campaigns/${campaign.id}`, {
      headers: authHeaders(token),
    });
    expect(del.status).toBe(400);

    const cancel = await makeRequest(app, ctx.env, 'POST', `/admin/campaigns/${campaign.id}/cancel`, {
      headers: authHeaders(token),
    });
    expect(cancel.status).toBe(400);
  });
});

export {};
