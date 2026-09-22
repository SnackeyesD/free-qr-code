import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVerifiedUser, makeRequest, createTestEnv, createTestApp } from './setup.js';

const app = createTestApp();

describe('QRCode API', () => {
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

  it('POST /qrcodes creates a dynamic QR code', async () => {
    const token = await loginUser('qruser1@example.com');
    const res = await makeRequest(app, ctx.env, 'POST', '/qrcodes', {
      body: {
        type: 'dynamique',
        contenu: 'https://example.com/updated',
        typeContenu: 'url',
        parametres: { taille: 512, correction: 'M', cadre: true },
      },
      headers: authHeaders(token),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; estDynamique: boolean; aliasCourt?: string; contenu: string };
    expect(body.estDynamique).toBe(true);
    expect(body.aliasCourt).toBeDefined();
    expect(body.contenu).toBe('https://example.com/updated');
  });

  it('POST /qrcodes creates a static QR code', async () => {
    const token = await loginUser('qruser2@example.com');
    const res = await makeRequest(app, ctx.env, 'POST', '/qrcodes', {
      body: {
        type: 'statique',
        contenu: 'https://example.com/static',
        typeContenu: 'url',
      },
      headers: authHeaders(token),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { estDynamique: boolean; contenu: string };
    expect(body.estDynamique).toBe(false);
    expect(body.contenu).toBe('https://example.com/static');
  });

  it('GET /qrcodes lists user QR codes', async () => {
    const token = await loginUser('qruser3@example.com');
    await makeRequest(app, ctx.env, 'POST', '/qrcodes', {
      body: { type: 'statique', contenu: 'https://a.com', typeContenu: 'url' },
      headers: authHeaders(token),
    });
    const res = await makeRequest(app, ctx.env, 'GET', '/qrcodes', { headers: authHeaders(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; total: number };
    expect(body.data.length).toBe(1);
    expect(body.total).toBe(1);
  });

  it('GET /qrcodes/:id returns a QR code', async () => {
    const token = await loginUser('qruser4@example.com');
    const create = await makeRequest(app, ctx.env, 'POST', '/qrcodes', {
      body: { type: 'statique', contenu: 'https://b.com', typeContenu: 'url' },
      headers: authHeaders(token),
    });
    const created = (await create.json()) as { id: string };
    const res = await makeRequest(app, ctx.env, 'GET', `/qrcodes/${created.id}`, { headers: authHeaders(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; contenu: string };
    expect(body.id).toBe(created.id);
    expect(body.contenu).toBe('https://b.com');
  });

  it('PATCH /qrcodes/:id updates a dynamic QR code content', async () => {
    const token = await loginUser('qruser5@example.com');
    const create = await makeRequest(app, ctx.env, 'POST', '/qrcodes', {
      body: { type: 'dynamique', contenu: 'https://old.com', typeContenu: 'url' },
      headers: authHeaders(token),
    });
    const created = (await create.json()) as { id: string; aliasCourt: string };
    const res = await makeRequest(app, ctx.env, 'PATCH', `/qrcodes/${created.id}`, {
      body: { contenu: 'https://new.com' },
      headers: authHeaders(token),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; contenu: string; aliasCourt: string };
    expect(body.contenu).toBe('https://new.com');
    expect(body.aliasCourt).toBe(created.aliasCourt);
  });

  it('DELETE /qrcodes/:id removes a QR code', async () => {
    const token = await loginUser('qruser6@example.com');
    const create = await makeRequest(app, ctx.env, 'POST', '/qrcodes', {
      body: { type: 'statique', contenu: 'https://delete.com', typeContenu: 'url' },
      headers: authHeaders(token),
    });
    const created = (await create.json()) as { id: string };
    const del = await makeRequest(app, ctx.env, 'DELETE', `/qrcodes/${created.id}`, { headers: authHeaders(token) });
    expect(del.status).toBe(204);
    const get = await makeRequest(app, ctx.env, 'GET', `/qrcodes/${created.id}`, { headers: authHeaders(token) });
    expect(get.status).toBe(404);
  });

  it('GET /qrcodes/:id returns 404 for another user QR code', async () => {
    const tokenA = await loginUser('qruser8a@example.com');
    const tokenB = await loginUser('qruser8b@example.com');
    const create = await makeRequest(app, ctx.env, 'POST', '/qrcodes', {
      body: { type: 'statique', contenu: 'https://private.com', typeContenu: 'url' },
      headers: authHeaders(tokenA),
    });
    const created = (await create.json()) as { id: string };
    const res = await makeRequest(app, ctx.env, 'GET', `/qrcodes/${created.id}`, { headers: authHeaders(tokenB) });
    expect(res.status).toBe(404);
  });

  it('GET /qrcodes/:id accepte le public_id UUID comme alias de lecture', async () => {
    const token = await loginUser('qruser9@example.com');
    const create = await makeRequest(app, ctx.env, 'POST', '/qrcodes', {
      body: { type: 'statique', contenu: 'https://public-id.com', typeContenu: 'url' },
      headers: authHeaders(token),
    });
    const created = (await create.json()) as { id: string };
    const row = ctx.db.prepare('SELECT public_id FROM qrcodes WHERE id = ?').get(Number(created.id)) as {
      public_id: string;
    };

    const byNumeric = await makeRequest(app, ctx.env, 'GET', `/qrcodes/${created.id}`, {
      headers: authHeaders(token),
    });
    expect(byNumeric.status).toBe(200);

    const byPublicId = await makeRequest(app, ctx.env, 'GET', `/qrcodes/${row.public_id}`, {
      headers: authHeaders(token),
    });
    expect(byPublicId.status).toBe(200);
    expect(((await byPublicId.json()) as { id: string }).id).toBe(created.id);

    const unknown = await makeRequest(app, ctx.env, 'GET', '/qrcodes/00000000-0000-4000-8000-000000000000', {
      headers: authHeaders(token),
    });
    expect(unknown.status).toBe(404);
  });

  it('PATCH /qrcodes/:id accepte le public_id UUID', async () => {
    const token = await loginUser('qruser10@example.com');
    const create = await makeRequest(app, ctx.env, 'POST', '/qrcodes', {
      body: { type: 'dynamique', contenu: 'https://patch-pub.com', typeContenu: 'url' },
      headers: authHeaders(token),
    });
    const created = (await create.json()) as { id: string };
    const row = ctx.db.prepare('SELECT public_id FROM qrcodes WHERE id = ?').get(Number(created.id)) as {
      public_id: string;
    };

    const patch = await makeRequest(app, ctx.env, 'PATCH', `/qrcodes/${row.public_id}`, {
      headers: authHeaders(token),
      body: { estActif: false },
    });
    expect(patch.status).toBe(200);
    expect(((await patch.json()) as { estActif: boolean }).estActif).toBe(false);
  });
});

export {};
