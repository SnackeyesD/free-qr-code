import { rateLimitMiddleware } from "../middlewares/rate-limit.js";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { sendResetEmail, sendVerificationEmail } from "../services/email.js";
import {
  getD1,
  nowDb,
  fromBoolean,
  type UserRow,
  type RefreshTokenRow,
} from "../lib/d1.js";
import {
  hashPassword,
  verifyPassword,
  createTokenPair,
  setAuthCookies,
  clearAuthCookies,
  verifyRefreshToken,
  sha256,
  extractRefreshTokenFromCookie,
  toPublicUser,
  authMiddleware,
} from "../services/auth.js";
import type { AppContext, AppEnv } from "../types/index.js";

const registerSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase().trim()),
  motDePasse: z.string().min(8),
  nom: z
    .string()
    .min(1)
    .transform((v) => v.trim()),
  consentementMarketing: z.boolean(),
});

const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase().trim()),
  motDePasse: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase().trim()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  motDePasse: z.string().min(8),
});

export const authRoutes = new Hono<AppEnv>();

authRoutes.use(
  "/register",
  rateLimitMiddleware as import("hono").MiddlewareHandler<AppEnv>,
);
authRoutes.use(
  "/login",
  rateLimitMiddleware as import("hono").MiddlewareHandler<AppEnv>,
);
authRoutes.use(
  "/refresh",
  rateLimitMiddleware as import("hono").MiddlewareHandler<AppEnv>,
);
authRoutes.use(
  "/forgot-password",
  rateLimitMiddleware as import("hono").MiddlewareHandler<AppEnv>,
);
authRoutes.use(
  "/reset-password",
  rateLimitMiddleware as import("hono").MiddlewareHandler<AppEnv>,
);

export function getClientIp(c: AppContext): string {
  const cf = c.req.header("CF-Connecting-IP");
  if (cf) return cf;
  const xff = c.req.header("X-Forwarded-For");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

async function getClientInfo(c: AppContext) {
  return {
    ip: getClientIp(c),
    userAgent: c.req.header("User-Agent") ?? "unknown",
  };
}

function mapUser(row: UserRow) {
  return {
    id: row.id,
    publicId: row.public_id,
    email: row.email,
    nom: row.nom,
    estVerifie: row.est_verifie === 1,
    consentementMarketing: row.consentement_marketing === 1,
    dateInscription: row.date_inscription,
    estActif: row.est_actif === 1,
    role: row.role,
    motDePasse: row.mot_de_passe,
    dateDerniereConnexion: row.date_derniere_connexion,
  };
}

function userPublicFromRow(row: UserRow) {
  return toPublicUser(mapUser(row));
}

authRoutes.post("/register", zValidator("json", registerSchema), async (c) => {
  const data = c.req.valid("json");
  const db = getD1(c.env);
  const existing = await db
    .prepare("SELECT id FROM utilisateurs WHERE email = ?")
    .bind(data.email.toLowerCase().trim())
    .first<{ id: number }>();
  if (existing) {
    throw new HTTPException(409, { message: "Email already used" });
  }
  const now = nowDb();
  const hashed = await hashPassword(data.motDePasse);
  const result = await db
    .prepare(
      "INSERT INTO utilisateurs (public_id, email, mot_de_passe, nom, est_verifie, consentement_marketing, date_consentement_marketing, date_inscription, est_actif, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      data.email.toLowerCase().trim(),
      hashed,
      data.nom.trim(),
      0,
      fromBoolean(data.consentementMarketing),
      data.consentementMarketing ? now : null,
      now,
      1,
      "utilisateur",
    )
    .run();
  const userId = result.meta?.last_row_id ?? 0;
  if (!userId) {
    throw new HTTPException(500, { message: "Failed to create user" });
  }

  const pair = await createTokenPair(c.env, String(userId), "utilisateur");
  const { ip, userAgent } = await getClientInfo(c);
  const refreshTokenHash = await sha256(pair.refreshToken);
  const accessJtiHash = await sha256(pair.accessJti);

  // --- Token de vérification email (colonnes réelles de tokens_email) ---
  const verificationTokenPlain = crypto.randomUUID();
  const verificationTokenHash = await sha256(verificationTokenPlain);
  const tokenExpiresAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000,
  ).toISOString();

  await db
    .prepare(
      "INSERT INTO tokens_email (public_id, id_utilisateur, token_hash, type, date_expiration, est_utilise) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      userId,
      verificationTokenHash,
      "verification",
      tokenExpiresAt,
      0,
    )
    .run();

  const verifyLink = `${c.env.FRONTEND_URL}/verify-email?token=${verificationTokenPlain}`;
  console.log("Les information du verify", verifyLink);

  // Envoi asynchrone, ne bloque pas la réponse à l'utilisateur
  c.executionCtx.waitUntil(
    sendVerificationEmail(c.env, data.email.toLowerCase().trim(), verifyLink),
  );

  // --- refresh_tokens (celui-là a bien user_agent/adresse_ip) ---
  await db
    .prepare(
      "INSERT INTO refresh_tokens (public_id, id_utilisateur, token_hash, access_token_jti_hash, user_agent, adresse_ip, date_creation, date_expiration, est_revoke) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      userId,
      refreshTokenHash,
      accessJtiHash,
      userAgent,
      ip,
      nowDb(),
      new Date(pair.refreshExpiresAt * 1000).toISOString(),
      0,
    )
    .run();

  setAuthCookies(c, pair);
  return c.json(
    {
      accessToken: pair.accessToken,
      expiresAt: pair.accessExpiresAt,
      user: {
        id: String(userId),
        email: data.email.toLowerCase().trim(),
        nom: data.nom.trim(),
        estVerifie: false,
        consentementMarketing: data.consentementMarketing,
        dateInscription: now,
        role: "utilisateur",
      },
    },
    201,
  );
});

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const data = c.req.valid("json");
  const db = getD1(c.env);
  const row = await db
    .prepare("SELECT * FROM utilisateurs WHERE email = ?")
    .bind(data.email.toLowerCase().trim())
    .first<UserRow>();
  console.log("Data");
  console.log(data);
  if (!row || !(await verifyPassword(data.motDePasse, row.mot_de_passe))) {
    throw new HTTPException(401, { message: "Invalid credentials" });
  }
  const user = mapUser(row);
  if (!user.estVerifie) {
    throw new HTTPException(401, { message: "Email not verified" });
  }
  if (!user.estActif) {
    throw new HTTPException(401, { message: "Account disabled" });
  }
  await db
    .prepare("UPDATE utilisateurs SET date_derniere_connexion = ? WHERE id = ?")
    .bind(nowDb(), user.id)
    .run();
  const pair = await createTokenPair(c.env, String(user.id), user.role);
  const { ip, userAgent } = await getClientInfo(c);
  const refreshTokenHash = await sha256(pair.refreshToken);
  const accessJtiHash = await sha256(pair.accessJti);
  await db
    .prepare(
      "INSERT INTO refresh_tokens (public_id, id_utilisateur, token_hash, access_token_jti_hash, user_agent, adresse_ip, date_creation, date_expiration, est_revoke) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      user.id,
      refreshTokenHash,
      accessJtiHash,
      userAgent,
      ip,
      nowDb(),
      new Date(pair.refreshExpiresAt * 1000).toISOString(),
      0,
    )
    .run();
  setAuthCookies(c, pair);
  console.log("ok");
  return c.json({
    accessToken: pair.accessToken,
    expiresAt: pair.accessExpiresAt,
    user: userPublicFromRow(row),
  });
});

authRoutes.post("/refresh", async (c) => {
  const cookieToken = extractRefreshTokenFromCookie(c);
  if (!cookieToken) {
    throw new HTTPException(401, { message: "Missing refresh token" });
  }
  const { userId, jti } = await verifyRefreshToken(c.env, cookieToken);
  const db = getD1(c.env);
  const tokenHash = await sha256(cookieToken);
  const stored = await db
    .prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?")
    .bind(tokenHash)
    .first<RefreshTokenRow>();
  if (
    !stored ||
    stored.est_revoke === 1 ||
    String(stored.id_utilisateur) !== userId
  ) {
    throw new HTTPException(401, {
      message: "Refresh token revoked or invalid",
    });
  }
  const userRow = await db
    .prepare("SELECT * FROM utilisateurs WHERE id = ?")
    .bind(stored.id_utilisateur)
    .first<UserRow>();
  if (!userRow || userRow.est_actif !== 1) {
    throw new HTTPException(401, { message: "Account disabled" });
  }
  const user = mapUser(userRow);
  await db
    .prepare(
      "UPDATE refresh_tokens SET est_revoke = ?, date_revocation = ? WHERE token_hash = ?",
    )
    .bind(1, nowDb(), tokenHash)
    .run();
  const pair = await createTokenPair(c.env, String(user.id), user.role);
  const { ip, userAgent } = await getClientInfo(c);
  const refreshTokenHash = await sha256(pair.refreshToken);
  const accessJtiHash = await sha256(pair.accessJti);
  await db
    .prepare(
      "INSERT INTO refresh_tokens (public_id, id_utilisateur, token_hash, access_token_jti_hash, user_agent, adresse_ip, date_creation, date_expiration, est_revoke) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      user.id,
      refreshTokenHash,
      accessJtiHash,
      userAgent,
      ip,
      nowDb(),
      new Date(pair.refreshExpiresAt * 1000).toISOString(),
      0,
    )
    .run();
  setAuthCookies(c, pair);
  return c.json({
    accessToken: pair.accessToken,
    expiresAt: pair.accessExpiresAt,
  });
});

authRoutes.post("/logout", authMiddleware, async (c) => {
  const cookieToken = extractRefreshTokenFromCookie(c);
  const db = getD1(c.env);
  if (cookieToken) {
    const tokenHash = await sha256(cookieToken);
    await db
      .prepare(
        "UPDATE refresh_tokens SET est_revoke = ?, date_revocation = ? WHERE token_hash = ? AND id_utilisateur = ?",
      )
      .bind(1, nowDb(), tokenHash, Number(c.get("userId")))
      .run();
  }
  clearAuthCookies(c);
  return c.json({ success: true });
});

authRoutes.post(
  "/verify-email",
  zValidator("json", verifyEmailSchema),
  async (c) => {
    const { token } = c.req.valid("json");
    const db = getD1(c.env);

    const tokenHash = await sha256(token);

    console.log("le token réçu ", tokenHash);
    const tokenRow = await db
      .prepare("SELECT * FROM tokens_email WHERE token_hash = ? AND type = ? ")
      .bind(tokenHash, "verification")
      .first<{
        id: number;
        id_utilisateur: number;
        date_expiration: string;
      }>();

    console.log("Les comparaisons ", tokenRow);
    if (!tokenRow) {
      throw new HTTPException(400, {
        message: "Invalid or expired verification token",
      });
    }
    if (new Date(tokenRow.date_expiration) < new Date()) {
      throw new HTTPException(400, { message: "Verification token expired" });
    }
    await db
      .prepare("UPDATE utilisateurs SET est_verifie = ? WHERE id = ?")
      .bind(1, tokenRow.id_utilisateur)
      .run();
    await db
      .prepare("UPDATE tokens_email SET est_utilise = ? WHERE id = ?")
      .bind(1, tokenRow.id)
      .run();
    const userRow = await db
      .prepare("SELECT * FROM utilisateurs WHERE id = ?")
      .bind(tokenRow.id_utilisateur)
      .first<UserRow>();
    if (!userRow) {
      throw new HTTPException(404, { message: "User not found" });
    }
    const user = mapUser(userRow);
    const pair = await createTokenPair(c.env, String(user.id), user.role);
    const { ip, userAgent } = await getClientInfo(c);
    const refreshTokenHash = await sha256(pair.refreshToken);
    const accessJtiHash = await sha256(pair.accessJti);
    await db
      .prepare(
        "INSERT INTO refresh_tokens (public_id, id_utilisateur, token_hash, access_token_jti_hash, user_agent, adresse_ip, date_creation, date_expiration, est_revoke) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        user.id,
        refreshTokenHash,
        accessJtiHash,
        userAgent,
        ip,
        nowDb(),
        new Date(pair.refreshExpiresAt * 1000).toISOString(),
        0,
      )
      .run();
    setAuthCookies(c, pair);
    return c.json({
      accessToken: pair.accessToken,
      expiresAt: pair.accessExpiresAt,
      user: userPublicFromRow(userRow),
    });
  },
);

function getFrontendBaseUrl(env: AppEnv["Bindings"]): string {
  const frontend = (env.FRONTEND_URL as unknown as string | undefined)?.trim();
  if (frontend) return frontend.replace(/\/$/, "");
  const apiBase = env.API_BASE_URL?.replace(/\/$/, "");
  if (apiBase) return apiBase;
  return "http://localhost:5173";
}

authRoutes.post(
  "/forgot-password",
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid("json");
    const db = getD1(c.env);
    const genericResponse = {
      success: true,
      message:
        "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.",
    };

    const row = await db
      .prepare("SELECT * FROM utilisateurs WHERE email = ?")
      .bind(email)
      .first<UserRow>();

    // Anti-énumération : réponse identique que le compte existe ou non.
    if (!row || row.est_actif !== 1) {
      return c.json(genericResponse);
    }

    // Invalide les demandes précédentes encore actives.
    await db
      .prepare(
        "UPDATE tokens_email SET est_utilise = ?, date_utilisation = ? WHERE id_utilisateur = ? AND type = ? AND est_utilise = ?",
      )
      .bind(1, nowDb(), row.id, "reinitialisation", 0)
      .run();

    const resetTokenPlain = crypto.randomUUID();
    const resetTokenHash = await sha256(resetTokenPlain);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db
      .prepare(
        "INSERT INTO tokens_email (public_id, id_utilisateur, token_hash, type, date_expiration, est_utilise) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        row.id,
        resetTokenHash,
        "reinitialisation",
        expiresAt,
        0,
      )
      .run();

    const resetLink = `${getFrontendBaseUrl(c.env)}/reset-password/${resetTokenPlain}`;
    c.executionCtx.waitUntil(sendResetEmail(c.env, row.email, resetLink));

    return c.json(genericResponse);
  },
);

authRoutes.post(
  "/reset-password",
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const { token, motDePasse } = c.req.valid("json");
    const db = getD1(c.env);
    const tokenHash = await sha256(token);

    const tokenRow = await db
      .prepare(
        "SELECT * FROM tokens_email WHERE token_hash = ? AND type = ?",
      )
      .bind(tokenHash, "reinitialisation")
      .first<{
        id: number;
        id_utilisateur: number;
        date_expiration: string;
        est_utilise: number;
      }>();

    if (!tokenRow || tokenRow.est_utilise === 1) {
      throw new HTTPException(400, {
        message: "Invalid or expired reset token",
      });
    }
    if (new Date(tokenRow.date_expiration) < new Date()) {
      throw new HTTPException(400, { message: "Reset token expired" });
    }

    const hashed = await hashPassword(motDePasse);
    await db
      .prepare("UPDATE utilisateurs SET mot_de_passe = ?, updated_at = ? WHERE id = ?")
      .bind(hashed, nowDb(), tokenRow.id_utilisateur)
      .run();
    await db
      .prepare("UPDATE tokens_email SET est_utilise = ?, date_utilisation = ? WHERE id = ?")
      .bind(1, nowDb(), tokenRow.id)
      .run();
    // Force la déconnexion des autres sessions après un reset.
    await db
      .prepare(
        "UPDATE refresh_tokens SET est_revoke = ?, date_revocation = ? WHERE id_utilisateur = ? AND date_revocation IS NULL",
      )
      .bind(1, nowDb(), tokenRow.id_utilisateur)
      .run();

    return c.json({ success: true });
  },
);
