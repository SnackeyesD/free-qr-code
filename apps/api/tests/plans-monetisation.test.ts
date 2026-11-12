import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HTTPException } from "hono/http-exception";
import type { RoutingConfig } from "@free-qr/shared-types";
import {
  createTestApp,
  createTestEnv,
  createVerifiedUser,
  makeRequest,
  type TestContext,
} from "./setup.js";
import {
  limitesRoutage,
  verifierLimites,
} from "../src/services/routing/limits.js";

const app = createTestApp();

function config(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    version: 1,
    actif: true,
    fuseau: "Africa/Brazzaville",
    defaut: "v_fr",
    variantes: [
      { id: "v_fr", libelle: "Profil FR", typeSortie: "url", contenu: "https://e.test/fr" },
      { id: "v_en", libelle: "Profil EN", typeSortie: "url", contenu: "https://e.test/en" },
    ],
    regles: [
      { id: "r_en", priorite: 10, varianteId: "v_en", conditions: { langues: ["en"] } },
    ],
    ...overrides,
  };
}

function statutErreur(fn: () => void): number | undefined {
  try {
    fn();
  } catch (err) {
    if (err instanceof HTTPException) return err.status;
    throw err;
  }
  return undefined;
}

describe("Phase 5 — couture de monétisation", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  async function login(email: string): Promise<string> {
    await createVerifiedUser(ctx.env, email, "StrongPass123!", "Test");
    const res = await makeRequest(app, ctx.env, "POST", "/auth/login", {
      body: { email, motDePasse: "StrongPass123!" },
    });
    return ((await res.json()) as { accessToken: string }).accessToken;
  }

  async function loginAdmin(email: string): Promise<string> {
    const user = await createVerifiedUser(ctx.env, email, "StrongPass123!", "Admin");
    ctx.db
      .prepare("UPDATE utilisateurs SET role = 'admin' WHERE id = ?")
      .run(Number(user.id));
    const res = await makeRequest(app, ctx.env, "POST", "/auth/login", {
      body: { email, motDePasse: "StrongPass123!" },
    });
    return ((await res.json()) as { accessToken: string }).accessToken;
  }

  async function createQr(
    token: string,
    nom?: string,
  ): Promise<{ id: string; aliasCourt: string }> {
    const res = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: {
        type: "dynamique",
        contenu: "https://example.com/base",
        typeContenu: "url",
        ...(nom ? { nom } : {}),
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(201);
    return (await res.json()) as { id: string; aliasCourt: string };
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function setPlan(userId: string, plan: "gratuit" | "pro"): void {
    ctx.db
      .prepare("UPDATE utilisateurs SET plan = ?, date_passage_pro = ? WHERE id = ?")
      .run(plan, plan === "pro" ? new Date().toISOString() : null, Number(userId));
  }

  it("migration 005 : plan par défaut 'gratuit' et table de consultation", async () => {
    const user = await createVerifiedUser(
      ctx.env,
      "plan-migration@example.com",
      "StrongPass123!",
      "Test",
    );

    const ligne = ctx.db
      .prepare("SELECT plan, date_passage_pro FROM utilisateurs WHERE id = ?")
      .get(Number(user.id)) as { plan: string; date_passage_pro: string | null };
    expect(ligne.plan).toBe("gratuit");
    expect(ligne.date_passage_pro).toBeNull();

    const table = ctx.db
      .prepare(
        `SELECT COUNT(*) AS total FROM sqlite_master
         WHERE type = 'table' AND name = 'routage_consultations_stats'`,
      )
      .get() as { total: number };
    expect(table.total).toBe(1);
  });

  describe("limitesRoutage / verifierLimites", () => {
    function env(overrides: Record<string, string> = {}) {
      return { ...ctx.env, ...overrides } as typeof ctx.env;
    }

    it("flag false : gratuit et illimité, comportement inchangé", () => {
      const limites = limitesRoutage(env({ ROUTING_PRO_ONLY: "false" }), "gratuit");
      expect(limites.autorise).toBe(true);
      expect(limites.variantes).toBeNull();
      expect(limites.regles).toBeNull();
      expect(() => verifierLimites(config(), limites)).not.toThrow();
    });

    it("flag true : gratuit bloqué en édition, pro illimité", () => {
      const gratuit = limitesRoutage(env({ ROUTING_PRO_ONLY: "true" }), "gratuit");
      expect(gratuit.autorise).toBe(false);
      expect(gratuit.variantes).toBe(1);
      expect(gratuit.regles).toBe(0);

      const pro = limitesRoutage(env({ ROUTING_PRO_ONLY: "true" }), "pro");
      expect(pro.autorise).toBe(true);
      expect(pro.variantes).toBeNull();
    });

    it("quota dépassé : 400 explicite, variantes puis règles", () => {
      const limites = {
        plan: "gratuit" as const,
        proOnly: true,
        autorise: true,
        variantes: 1,
        regles: 0,
      };

      expect(statutErreur(() => verifierLimites(config(), limites))).toBe(400);

      const uneVariante = config({
        variantes: [config().variantes[0]],
        defaut: "v_fr",
        regles: [],
      });
      expect(statutErreur(() => verifierLimites(uneVariante, limites))).toBeUndefined();
    });

    it("flag true : 402 pour un compte gratuit, jamais au runtime", () => {
      const limites = limitesRoutage(env({ ROUTING_PRO_ONLY: "true" }), "gratuit");
      expect(statutErreur(() => verifierLimites(config(), limites))).toBe(402);
    });
  });

  it("ROUTING_PRO_ONLY=false : un compte gratuit peut enregistrer", async () => {
    ctx.env.ROUTING_PRO_ONLY = "false";
    const token = await login("gratuit-libre@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config(),
      headers: auth(token),
    });
    expect(res.status, await res.clone().text()).toBe(200);
  });

  it("ROUTING_PRO_ONLY=true : PUT gratuit → 402, PUT pro → 200", async () => {
    ctx.env.ROUTING_PRO_ONLY = "true";

    const user = await createVerifiedUser(
      ctx.env,
      "gratuit-bloque@example.com",
      "StrongPass123!",
      "Test",
    );
    const loginRes = await makeRequest(app, ctx.env, "POST", "/auth/login", {
      body: { email: "gratuit-bloque@example.com", motDePasse: "StrongPass123!" },
    });
    const token = ((await loginRes.json()) as { accessToken: string }).accessToken;
    const qr = await createQr(token);

    const bloque = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config(),
      headers: auth(token),
    });
    expect(bloque.status).toBe(402);

    setPlan(user.id, "pro");
    const autorise = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config(),
      headers: auth(token),
    });
    expect(autorise.status, await autorise.clone().text()).toBe(200);
  });

  it("ROUTING_PRO_ONLY=true : un QR déjà routé continue de router", async () => {
    ctx.env.ROUTING_PRO_ONLY = "false";
    const token = await login("deja-route@example.com");
    const qr = await createQr(token);

    const sauvegarde = await makeRequest(
      app,
      ctx.env,
      "PUT",
      `/qrcodes/${qr.id}/routage`,
      { body: config(), headers: auth(token) },
    );
    expect(sauvegarde.status).toBe(200);

    // Bascule commerciale : le runtime ne doit jamais lire le plan.
    ctx.env.ROUTING_PRO_ONLY = "true";
    ctx.db
      .prepare("UPDATE utilisateurs SET plan = 'gratuit' WHERE email = ?")
      .run("deja-route@example.com");

    const scan = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`);
    expect(scan.status).toBe(302);
    expect(scan.headers.get("location")).toBe("https://e.test/fr?cfq=v_fr");

    // Une seule requête D1 sur le chemin chaud (le QR), jamais `utilisateurs`.
    const plan = ctx.db
      .prepare("SELECT plan FROM utilisateurs WHERE email = ?")
      .get("deja-route@example.com") as { plan: string };
    expect(plan.plan).toBe("gratuit");
  });

  it("GET /admin/routing/metrics : adoption, consultations, plans", async () => {
    const adminToken = await loginAdmin("admin-metrics@example.com");
    const user = await createVerifiedUser(
      ctx.env,
      "metrics-user@example.com",
      "StrongPass123!",
      "Test",
    );
    const loginRes = await makeRequest(app, ctx.env, "POST", "/auth/login", {
      body: { email: "metrics-user@example.com", motDePasse: "StrongPass123!" },
    });
    const token = ((await loginRes.json()) as { accessToken: string }).accessToken;

    const qr = await createQr(token);
    await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config(),
      headers: auth(token),
    });

    // Une consultation de l'écran de stats est instrumentée (waitUntil drainé).
    const stats = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/qrcodes/${qr.id}/routage/stats`,
      { headers: auth(token) },
    );
    expect(stats.status).toBe(200);

    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      "/admin/routing/metrics",
      { headers: auth(adminToken) },
    );
    expect(res.status, await res.clone().text()).toBe(200);

    const metrics = (await res.json()) as {
      proOnly: boolean;
      qrTotal: number;
      qrAvecRoutage: number;
      qrMultiVariantes: number;
      comptesRoutage: number;
      consultationsStats: { total: number; trenteJours: number; comptes: number };
      plans: { gratuit: number; pro: number };
      genereLe: string;
    };

    expect(metrics.proOnly).toBe(false);
    expect(metrics.qrTotal).toBe(1);
    expect(metrics.qrAvecRoutage).toBe(1);
    expect(metrics.qrMultiVariantes).toBe(1);
    expect(metrics.comptesRoutage).toBe(1);
    expect(metrics.consultationsStats.total).toBe(1);
    expect(metrics.consultationsStats.trenteJours).toBe(1);
    expect(metrics.consultationsStats.comptes).toBe(1);
    expect(metrics.plans.gratuit).toBe(2);
    expect(metrics.plans.pro).toBe(0);
    expect(Date.parse(metrics.genereLe)).not.toBeNaN();

    // Les données restent agrégées : aucun email dans la réponse.
    const brut = JSON.stringify(metrics);
    expect(brut).not.toContain("metrics-user@example.com");
    expect(brut).not.toContain("admin-metrics@example.com");
  });

  it("GET /admin/routing/metrics est réservé aux admins", async () => {
    const token = await login("pas-admin@example.com");
    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      "/admin/routing/metrics",
      { headers: auth(token) },
    );
    expect(res.status).toBe(403);
  });
});
