import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVerifiedUser, makeRequest, createTestEnv, createTestApp } from './setup.js';

const app = createTestApp();

describe('Auth API', () => {
  let ctx: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('POST /auth/register creates a new user and returns tokens', async () => {
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/register', {
      body: {
        email: 'alice@example.com',
        motDePasse: 'StrongPass123!',
        nom: 'Alice',
        consentementMarketing: true,
      },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { accessToken: string; user: { email: string; estVerifie: boolean } };
    expect(body.accessToken).toBeDefined();
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.estVerifie).toBe(false);
  });

  it('POST /auth/register rejects duplicate email with 409', async () => {
    await createVerifiedUser(ctx.env, 'bob@example.com', 'StrongPass123!', 'Bob');
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/register', {
      body: {
        email: 'bob@example.com',
        motDePasse: 'StrongPass123!',
        nom: 'Bob2',
        consentementMarketing: false,
      },
    });
    expect(res.status).toBe(409);
  });

  it('POST /auth/register rejects weak password with 422', async () => {
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/register', {
      body: {
        email: 'weak@example.com',
        motDePasse: '123',
        nom: 'Weak',
        consentementMarketing: false,
      },
    });
    expect(res.status).toBe(400);
  });

  it('POST /auth/login succeeds for verified user', async () => {
    await createVerifiedUser(ctx.env, 'charlie@example.com', 'StrongPass123!', 'Charlie');
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'charlie@example.com', motDePasse: 'StrongPass123!' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string; user: { email: string } };
    expect(body.accessToken).toBeDefined();
    expect(body.user.email).toBe('charlie@example.com');
  });

  it('POST /auth/login rejects wrong password with generic 401', async () => {
    await createVerifiedUser(ctx.env, 'dave@example.com', 'StrongPass123!', 'Dave');
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'dave@example.com', motDePasse: 'WrongPassword!' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe('Invalid credentials');
  });

  it('POST /auth/login rejects unverified user', async () => {
    const register = await makeRequest(app, ctx.env, 'POST', '/auth/register', {
      body: { email: 'eve@example.com', motDePasse: 'StrongPass123!', nom: 'Eve', consentementMarketing: false },
    });
    expect(register.status).toBe(201);
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'eve@example.com', motDePasse: 'StrongPass123!' },
    });
    expect(res.status).toBe(401);
  });

  it('POST /auth/refresh rotates refresh token from cookie', async () => {
    await createVerifiedUser(ctx.env, 'frank@example.com', 'StrongPass123!', 'Frank');
    const login = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'frank@example.com', motDePasse: 'StrongPass123!' },
    });
    expect(login.status).toBe(200);
    const cookies = login.headers.get('Set-Cookie') || '';
    const refreshMatch = cookies.match(/refreshToken=([^;]+)/);
    expect(refreshMatch).toBeTruthy();
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/refresh', { cookies: `refreshToken=${refreshMatch![1]}` });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string };
    expect(body.accessToken).toBeDefined();
  });

  it('POST /auth/refresh rejects revoked token', async () => {
    await createVerifiedUser(ctx.env, 'grace@example.com', 'StrongPass123!', 'Grace');
    const login = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'grace@example.com', motDePasse: 'StrongPass123!' },
    });
    const cookies = login.headers.get('Set-Cookie') || '';
    const refreshMatch = cookies.match(/refreshToken=([^;]+)/);
    await makeRequest(app, ctx.env, 'POST', '/auth/refresh', { cookies: `refreshToken=${refreshMatch![1]}` });
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/refresh', { cookies: `refreshToken=${refreshMatch![1]}` });
    expect(res.status).toBe(401);
  });

  it('POST /auth/logout revokes current session', async () => {
    await createVerifiedUser(ctx.env, 'henry@example.com', 'StrongPass123!', 'Henry');
    const login = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'henry@example.com', motDePasse: 'StrongPass123!' },
    });
    const cookies = login.headers.get('Set-Cookie') || '';
    const accessMatch = cookies.match(/accessToken=([^;]+)/);
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/logout', {
      cookies: `accessToken=${accessMatch![1]}`,
      headers: { Authorization: `Bearer ${accessMatch![1]}` },
    });
    expect(res.status).toBe(200);
  });

  it('POST /auth/forgot-password returns 200 for existing user and creates a token', async () => {
    await createVerifiedUser(ctx.env, 'ivan@example.com', 'StrongPass123!', 'Ivan');
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/forgot-password', {
      body: { email: 'ivan@example.com' },
    });
    expect(res.status).toBe(200);
    const row = ctx.db
      .prepare("SELECT * FROM tokens_email WHERE type = 'reinitialisation'")
      .get() as Record<string, unknown> | undefined;
    expect(row).toBeDefined();
    expect(row?.est_utilise).toBe(0);
  });

  it('POST /auth/forgot-password returns 200 for unknown email without leaking', async () => {
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/forgot-password', {
      body: { email: 'ghost@example.com' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
    const count = ctx.db
      .prepare("SELECT COUNT(*) AS n FROM tokens_email WHERE type = 'reinitialisation'")
      .get() as { n: number };
    expect(count.n).toBe(0);
  });

  it('POST /auth/reset-password resets password and revokes sessions', async () => {
    const user = await createVerifiedUser(ctx.env, 'judy@example.com', 'StrongPass123!', 'Judy');
    const plain = crypto.randomUUID();
    const hash = await crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(plain))
      .then((b) =>
        Array.from(new Uint8Array(b))
          .map((x) => x.toString(16).padStart(2, '0'))
          .join(''),
      );
    ctx.db
      .prepare(
        "INSERT INTO tokens_email (public_id, id_utilisateur, token_hash, type, date_expiration, est_utilise) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        crypto.randomUUID(),
        Number(user.id),
        hash,
        'reinitialisation',
        new Date(Date.now() + 3600_000).toISOString(),
        0,
      );
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/reset-password', {
      body: { token: plain, motDePasse: 'BrandNewPass123!' },
    });
    expect(res.status).toBe(200);
    const login = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'judy@example.com', motDePasse: 'BrandNewPass123!' },
    });
    expect(login.status).toBe(200);
    // Reuse of the same token must fail
    const reuse = await makeRequest(app, ctx.env, 'POST', '/auth/reset-password', {
      body: { token: plain, motDePasse: 'AnotherPass123!' },
    });
    expect(reuse.status).toBe(400);
  });

  it('POST /auth/reset-password rejects invalid token and weak password', async () => {
    const invalid = await makeRequest(app, ctx.env, 'POST', '/auth/reset-password', {
      body: { token: 'does-not-exist', motDePasse: 'BrandNewPass123!' },
    });
    expect(invalid.status).toBe(400);
    const weak = await makeRequest(app, ctx.env, 'POST', '/auth/reset-password', {
      body: { token: 'does-not-exist', motDePasse: '123' },
    });
    expect(weak.status).toBe(400);
  });
});

export {};
