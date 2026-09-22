import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVerifiedUser, makeRequest, createTestEnv, createTestApp } from './setup.js';

const app = createTestApp();

function getResetToken(ctx: ReturnType<typeof createTestEnv>, email: string): string {
  const user = ctx.db.prepare('SELECT id FROM utilisateurs WHERE email = ?').get(email) as { id: number };
  const row = ctx.db
    .prepare("SELECT token_hash FROM tokens_email WHERE id_utilisateur = ? AND type = 'reinitialisation' AND est_utilise = 0")
    .get(user.id) as { token_hash: string } | undefined;
  if (!row) throw new Error('reset token not found');
  return row.token_hash;
}

describe('Auth password reset', () => {
  let ctx: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('POST /auth/forgot-password répond 200 même pour un email inconnu (anti-énumération)', async () => {
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/forgot-password', {
      body: { email: 'unknown@example.com' },
    });
    expect(res.status).toBe(200);
    const count = ctx.db.prepare('SELECT COUNT(*) AS n FROM tokens_email').get() as { n: number };
    expect(count.n).toBe(0);
  });

  it('POST /auth/forgot-password crée un token de réinitialisation', async () => {
    await createVerifiedUser(ctx.env, 'reset@example.com', 'OldPass123!', 'Reset');
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/forgot-password', {
      body: { email: 'reset@example.com' },
    });
    expect(res.status).toBe(200);
    expect(getResetToken(ctx, 'reset@example.com')).toBeTruthy();
  });

  it('POST /auth/reset-password change le mot de passe (ancien refusé, nouveau accepté)', async () => {
    await createVerifiedUser(ctx.env, 'change@example.com', 'OldPass123!', 'Change');
    await makeRequest(app, ctx.env, 'POST', '/auth/forgot-password', {
      body: { email: 'change@example.com' },
    });

    const reset = await makeRequest(app, ctx.env, 'POST', '/auth/reset-password', {
      body: { token: getResetToken(ctx, 'change@example.com'), motDePasse: 'NewPass456!' },
    });
    expect(reset.status).toBe(200);

    const oldLogin = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'change@example.com', motDePasse: 'OldPass123!' },
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'change@example.com', motDePasse: 'NewPass456!' },
    });
    expect(newLogin.status).toBe(200);
  });

  it('POST /auth/reset-password rejette la réutilisation du token (400)', async () => {
    await createVerifiedUser(ctx.env, 'reuse@example.com', 'OldPass123!', 'Reuse');
    await makeRequest(app, ctx.env, 'POST', '/auth/forgot-password', {
      body: { email: 'reuse@example.com' },
    });
    const token = getResetToken(ctx, 'reuse@example.com');

    expect(
      (await makeRequest(app, ctx.env, 'POST', '/auth/reset-password', { body: { token, motDePasse: 'NewPass456!' } })).status,
    ).toBe(200);
    const again = await makeRequest(app, ctx.env, 'POST', '/auth/reset-password', {
      body: { token, motDePasse: 'OtherPass789!' },
    });
    expect(again.status).toBe(400);
  });

  it('POST /auth/reset-password rejette un token inconnu et un mot de passe trop court', async () => {
    const unknown = await makeRequest(app, ctx.env, 'POST', '/auth/reset-password', {
      body: { token: 'no-such-token', motDePasse: 'NewPass456!' },
    });
    expect(unknown.status).toBe(400);

    const short = await makeRequest(app, ctx.env, 'POST', '/auth/reset-password', {
      body: { token: 'no-such-token', motDePasse: '123' },
    });
    expect(short.status).toBe(400);
  });

  it('POST /auth/reset-password révoque les sessions existantes', async () => {
    await createVerifiedUser(ctx.env, 'sessions@example.com', 'OldPass123!', 'Sessions');
    const login = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: 'sessions@example.com', motDePasse: 'OldPass123!' },
    });
    const cookies = login.headers.get('Set-Cookie') || '';
    const refreshMatch = cookies.match(/refreshToken=([^;]+)/);
    expect(refreshMatch).toBeTruthy();

    await makeRequest(app, ctx.env, 'POST', '/auth/forgot-password', {
      body: { email: 'sessions@example.com' },
    });
    const reset = await makeRequest(app, ctx.env, 'POST', '/auth/reset-password', {
      body: { token: getResetToken(ctx, 'sessions@example.com'), motDePasse: 'NewPass456!' },
    });
    expect(reset.status).toBe(200);

    const refresh = await makeRequest(app, ctx.env, 'POST', '/auth/refresh', {
      cookies: `refreshToken=${refreshMatch![1]}`,
    });
    expect(refresh.status).toBe(401);
  });
});

export {};
