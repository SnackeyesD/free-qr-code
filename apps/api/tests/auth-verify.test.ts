import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeRequest, createTestEnv, createTestApp } from './setup.js';

const app = createTestApp();

const REGISTER_BODY = {
  email: 'vera@example.com',
  motDePasse: 'StrongPass123!',
  nom: 'Vera',
  consentementMarketing: false,
};

function getVerificationToken(ctx: ReturnType<typeof createTestEnv>, userId: string): string {
  const row = ctx.db
    .prepare("SELECT token_hash FROM tokens_email WHERE id_utilisateur = ? AND type = 'verification' AND est_utilise = 0")
    .get(Number(userId)) as { token_hash: string } | undefined;
  if (!row) throw new Error('verification token not found');
  return row.token_hash;
}

describe('Auth verify-email', () => {
  let ctx: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("l'inscription crée un token de vérification", async () => {
    const register = await makeRequest(app, ctx.env, 'POST', '/auth/register', { body: REGISTER_BODY });
    expect(register.status).toBe(201);
    const body = (await register.json()) as { user: { id: string } };
    const count = ctx.db
      .prepare("SELECT COUNT(*) AS n FROM tokens_email WHERE id_utilisateur = ? AND type = 'verification'")
      .get(Number(body.user.id)) as { n: number };
    expect(count.n).toBe(1);
  });

  it('POST /auth/verify-email valide le compte puis autorise le login', async () => {
    const register = await makeRequest(app, ctx.env, 'POST', '/auth/register', { body: REGISTER_BODY });
    const { user } = (await register.json()) as { user: { id: string } };

    const verify = await makeRequest(app, ctx.env, 'POST', '/auth/verify-email', {
      body: { token: getVerificationToken(ctx, user.id) },
    });
    expect(verify.status).toBe(200);

    const login = await makeRequest(app, ctx.env, 'POST', '/auth/login', {
      body: { email: REGISTER_BODY.email, motDePasse: REGISTER_BODY.motDePasse },
    });
    expect(login.status).toBe(200);
  });

  it('POST /auth/verify-email rejette un token inconnu (400)', async () => {
    const res = await makeRequest(app, ctx.env, 'POST', '/auth/verify-email', {
      body: { token: 'no-such-token' },
    });
    expect(res.status).toBe(400);
  });

  it('POST /auth/verify-email rejette la réutilisation (400)', async () => {
    const register = await makeRequest(app, ctx.env, 'POST', '/auth/register', { body: REGISTER_BODY });
    const { user } = (await register.json()) as { user: { id: string } };
    const token = getVerificationToken(ctx, user.id);

    expect((await makeRequest(app, ctx.env, 'POST', '/auth/verify-email', { body: { token } })).status).toBe(200);
    const reuse = await makeRequest(app, ctx.env, 'POST', '/auth/verify-email', { body: { token } });
    expect(reuse.status).toBe(400);
  });

  it('POST /auth/verify-email rejette un token du mauvais type (400)', async () => {
    const register = await makeRequest(app, ctx.env, 'POST', '/auth/register', { body: REGISTER_BODY });
    expect(register.status).toBe(201);
    const { user } = (await register.json()) as { user: { id: string } };

    await makeRequest(app, ctx.env, 'POST', '/auth/forgot-password', { body: { email: REGISTER_BODY.email } });
    const resetRow = ctx.db
      .prepare("SELECT token_hash FROM tokens_email WHERE id_utilisateur = ? AND type = 'reinitialisation'")
      .get(Number(user.id)) as { token_hash: string };

    const res = await makeRequest(app, ctx.env, 'POST', '/auth/verify-email', {
      body: { token: resetRow.token_hash },
    });
    expect(res.status).toBe(400);
  });
});

export {};
