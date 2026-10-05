import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVerifiedUser, makeRequest, createTestEnv, createTestApp } from './setup.js';

const app = createTestApp();

describe('API keys', () => {
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

  function jwtHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createKey(token: string, body: unknown) {
    return makeRequest(app, ctx.env, 'POST', '/api-keys', {
      headers: jwtHeaders(token),
      body,
    });
  }

  it('POST /api-keys creates a key, secret shown once then hidden', async () => {
    const token = await loginUser('keyuser1@example.com');
    const res = await createKey(token, { nom: 'CI', permissions: ['qrcodes:read'] });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; cle: string; prefix: string };
    expect(created.cle).toBeDefined();
    expect(created.cle.length).toBeGreaterThan(8);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);

    const list = await makeRequest(app, ctx.env, 'GET', '/api-keys', { headers: jwtHeaders(token) });
    expect(list.status).toBe(200);
    const { data } = (await list.json()) as { data: Array<{ id: string; prefix: string; cle?: string }> };
    expect(data.length).toBe(1);
    expect(data[0].id).toBe(created.id);
    expect(data[0].cle).toBeUndefined();
    expect(data[0].prefix).toBe(created.prefix);
  });

  it('POST /api-keys accepts datetime-local expiration and normalizes to ISO', async () => {
    const token = await loginUser('keyuser2@example.com');
    const res = await createKey(token, { nom: 'CI exp', dateExpiration: '2027-12-31T23:59' });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { dateExpiration: string };
    expect(new Date(created.dateExpiration).getTime()).toBe(
      new Date('2027-12-31T23:59').getTime(),
    );
  });

  it('POST /api-keys rejects invalid, past and unknown-permission inputs', async () => {
    const token = await loginUser('keyuser3@example.com');
    const invalidDate = await createKey(token, { nom: 'bad', dateExpiration: 'pas-une-date' });
    expect(invalidDate.status).toBe(400);
    const pastDate = await createKey(token, { nom: 'past', dateExpiration: '2020-01-01T00:00' });
    expect(pastDate.status).toBe(400);
    const badPerm = await createKey(token, { nom: 'perm', permissions: ['nope:ever'] });
    expect(badPerm.status).toBe(400);
  });

  it('GET/DELETE /api-keys/:id is scoped to the owner', async () => {
    const tokenA = await loginUser('keyuser4a@example.com');
    const created = (await (
      await createKey(tokenA, { nom: 'mine' })
    ).json()) as { id: string };
    const tokenB = await loginUser('keyuser4b@example.com');

    const foreign = await makeRequest(app, ctx.env, 'GET', `/api-keys/${created.id}`, {
      headers: jwtHeaders(tokenB),
    });
    expect(foreign.status).toBe(404);

    const unknown = await makeRequest(app, ctx.env, 'DELETE', '/api-keys/00000000-0000-0000-0000-000000000000', {
      headers: jwtHeaders(tokenA),
    });
    expect(unknown.status).toBe(404);
  });

  it('API key with qrcodes:create can create but not delete QR codes', async () => {
    const token = await loginUser('keyuser5@example.com');
    const created = (await (
      await createKey(token, { nom: 'writer', permissions: ['qrcodes:create'] })
    ).json()) as { cle: string };
    const keyHeaders = { 'X-API-Key': created.cle };

    const post = await makeRequest(app, ctx.env, 'POST', '/qrcodes', {
      headers: keyHeaders,
      body: { type: 'statique', contenu: 'https://key-created.example', typeContenu: 'url' },
    });
    expect(post.status).toBe(201);

    const del = await makeRequest(app, ctx.env, 'DELETE', '/qrcodes/1', { headers: keyHeaders });
    expect(del.status).toBe(403);
  });

  it('API key read permission gates listing, invalid key is 401', async () => {
    const token = await loginUser('keyuser6@example.com');
    const reader = (await (
      await createKey(token, { nom: 'reader', permissions: ['qrcodes:read'] })
    ).json()) as { cle: string };
    const writer = (await (
      await createKey(token, { nom: 'writer', permissions: ['qrcodes:create'] })
    ).json()) as { cle: string };

    const ok = await makeRequest(app, ctx.env, 'GET', '/qrcodes', {
      headers: { 'X-API-Key': reader.cle },
    });
    expect(ok.status).toBe(200);

    // Fallback scheme Authorization: ApiKey
    const okFallback = await makeRequest(app, ctx.env, 'GET', '/qrcodes', {
      headers: { Authorization: `ApiKey ${reader.cle}` },
    });
    expect(okFallback.status).toBe(200);

    const forbidden = await makeRequest(app, ctx.env, 'GET', '/qrcodes', {
      headers: { 'X-API-Key': writer.cle },
    });
    expect(forbidden.status).toBe(403);

    const bogus = await makeRequest(app, ctx.env, 'GET', '/qrcodes', {
      headers: { 'X-API-Key': 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
    });
    expect(bogus.status).toBe(401);
  });

  it('revoked and expired API keys are rejected', async () => {
    const token = await loginUser('keyuser7@example.com');
    const revoked = (await (
      await createKey(token, { nom: 'doomed', permissions: ['qrcodes:read'] })
    ).json()) as { id: string; cle: string };
    const del = await makeRequest(app, ctx.env, 'DELETE', `/api-keys/${revoked.id}`, {
      headers: jwtHeaders(token),
    });
    expect(del.status).toBe(200);
    const afterRevoke = await makeRequest(app, ctx.env, 'GET', '/qrcodes', {
      headers: { 'X-API-Key': revoked.cle },
    });
    expect(afterRevoke.status).toBe(401);

    const expiring = (await (
      await createKey(token, {
        nom: 'expiring',
        permissions: ['qrcodes:read'],
        dateExpiration: '2027-01-01T00:00',
      })
    ).json()) as { id: string; cle: string };
    // Recule création + expiration (le CHECK impose expiration > création).
    ctx.db
      .prepare('UPDATE cles_api SET date_creation = ?, date_expiration = ? WHERE public_id = ?')
      .run('2019-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', expiring.id);
    const afterExpiry = await makeRequest(app, ctx.env, 'GET', '/qrcodes', {
      headers: { 'X-API-Key': expiring.cle },
    });
    expect(afterExpiry.status).toBe(401);
  });
});

export {};
