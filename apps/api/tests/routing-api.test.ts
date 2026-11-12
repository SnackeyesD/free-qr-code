import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { RoutingConfig } from "@free-qr/shared-types";
import {
  createTestApp,
  createTestEnv,
  createVerifiedUser,
  makeRequest,
  type TestContext,
} from "./setup.js";

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

describe("Routing API", () => {
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
    const body = (await res.json()) as { accessToken: string };
    return body.accessToken;
  }

  async function createQr(
    token: string,
    type: "statique" | "dynamique" = "dynamique",
  ): Promise<{ id: string; aliasCourt?: string }> {
    const res = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: { type, contenu: "https://example.com/base", typeContenu: "url" },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(201);
    return (await res.json()) as { id: string; aliasCourt?: string };
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it("GET /qrcodes/:id/routage renvoie un état vide par défaut", async () => {
    const token = await login("routing1@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "GET", `/qrcodes/${qr.id}/routage`, {
      headers: auth(token),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      reglesRoutage: unknown;
      fuseau: string;
      estDynamique: boolean;
    };
    expect(body.reglesRoutage).toBeNull();
    expect(body.fuseau).toBe("Africa/Brazzaville");
    expect(body.estDynamique).toBe(true);
  });

  it("PUT enregistre une configuration valide", async () => {
    const token = await login("routing2@example.com");
    const qr = await createQr(token);
    const cfg = config();

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: cfg,
      headers: auth(token),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { reglesRoutage: RoutingConfig };
    expect(body.reglesRoutage.variantes).toHaveLength(2);
    expect(body.reglesRoutage.defaut).toBe("v_fr");

    const persisted = await makeRequest(app, ctx.env, "GET", `/qrcodes/${qr.id}/routage`, {
      headers: auth(token),
    });
    const state = (await persisted.json()) as { reglesRoutage: RoutingConfig };
    expect(state.reglesRoutage.regles[0].id).toBe("r_en");
  });

  it("refuse un routage actif avec une seule variante", async () => {
    const token = await login("routing3@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config({
        variantes: [
          { id: "v_fr", libelle: "Seule", typeSortie: "url", contenu: "https://e.test/fr" },
        ],
        regles: [],
      }),
      headers: auth(token),
    });

    expect(res.status).toBe(400);
  });

  it("refuse des priorités dupliquées (ordre ambigu)", async () => {
    const token = await login("routing4@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config({
        regles: [
          { id: "r_a", priorite: 10, varianteId: "v_en", conditions: { langues: ["en"] } },
          { id: "r_b", priorite: 10, varianteId: "v_fr", conditions: { pays: ["CG"] } },
        ],
      }),
      headers: auth(token),
    });

    expect(res.status).toBe(400);
  });

  it("refuse un défaut qui ne correspond à aucune variante", async () => {
    const token = await login("routing5@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config({ defaut: "v_inconnue" }),
      headers: auth(token),
    });

    expect(res.status).toBe(400);
  });

  it("refuse une URL de destination invalide", async () => {
    const token = await login("routing6@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config({
        variantes: [
          { id: "v_fr", libelle: "FR", typeSortie: "url", contenu: "javascript:alert(1)" },
          { id: "v_en", libelle: "EN", typeSortie: "url", contenu: "https://e.test/en" },
        ],
      }),
      headers: auth(token),
    });

    expect(res.status).toBe(400);
  });

  it("refuse un fuseau horaire inconnu", async () => {
    const token = await login("routing7@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config({ fuseau: "Mars/Olympus" }),
      headers: auth(token),
    });

    expect(res.status).toBe(400);
  });

  it("refuse le routage sur un QR statique", async () => {
    const token = await login("routing8@example.com");
    const qr = await createQr(token, "statique");

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config(),
      headers: auth(token),
    });

    expect(res.status).toBe(400);
  });

  it("isole les comptes (QR d'un autre utilisateur → 404)", async () => {
    const tokenA = await login("routing9a@example.com");
    const qr = await createQr(tokenA);
    const tokenB = await login("routing9b@example.com");

    const res = await makeRequest(app, ctx.env, "GET", `/qrcodes/${qr.id}/routage`, {
      headers: auth(tokenB),
    });

    expect(res.status).toBe(404);
  });

  it("simule une langue et renvoie la trace", async () => {
    const token = await login("routing10@example.com");
    const qr = await createQr(token);
    await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config(),
      headers: auth(token),
    });

    const res = await makeRequest(
      app,
      ctx.env,
      "POST",
      `/qrcodes/${qr.id}/routage/simuler`,
      { body: { langue: "en" }, headers: auth(token) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      varianteId: string;
      regleId: string | null;
      trace: Array<{ regleId: string; correspond: boolean }>;
    };
    expect(body.varianteId).toBe("v_en");
    expect(body.regleId).toBe("r_en");
    expect(body.trace[0]).toMatchObject({ regleId: "r_en", correspond: true });
  });

  it("simule une configuration non enregistrée (aperçu live)", async () => {
    const token = await login("routing11@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(
      app,
      ctx.env,
      "POST",
      `/qrcodes/${qr.id}/routage/simuler`,
      {
        body: { config: config(), langue: "en" },
        headers: auth(token),
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { varianteId: string };
    expect(body.varianteId).toBe("v_en");
  });

  it("DELETE désactive le routage sans toucher au contenu du QR", async () => {
    const token = await login("routing12@example.com");
    const qr = await createQr(token);
    await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config(),
      headers: auth(token),
    });

    const res = await makeRequest(app, ctx.env, "DELETE", `/qrcodes/${qr.id}/routage`, {
      headers: auth(token),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      reglesRoutage: unknown;
      contenu: string;
    };
    expect(body.reglesRoutage).toBeNull();
    expect(body.contenu).toBe("https://example.com/base");
  });

  it("refuse l'accès sans authentification", async () => {
    const token = await login("routing13@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "GET", `/qrcodes/${qr.id}/routage`);

    expect(res.status).toBe(401);
  });

  it("accepte une règle A/B pondérée", async () => {
    const token = await login("routing14@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config({
        variantes: [
          { id: "v_fr", libelle: "FR", typeSortie: "url", contenu: "https://e.test/fr", poids: 70 },
          { id: "v_en", libelle: "EN", typeSortie: "url", contenu: "https://e.test/en", poids: 30 },
        ],
        regles: [
          {
            id: "r_ab",
            priorite: 10,
            varianteId: ["v_fr", "v_en"],
            conditions: { abTest: true },
          },
        ],
      }),
      headers: auth(token),
    });

    expect(res.status).toBe(200);
  });

  it("refuse un tableau de variantes sans marqueur abTest", async () => {
    const token = await login("routing15@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config({
        regles: [
          {
            id: "r_ab",
            priorite: 10,
            varianteId: ["v_fr", "v_en"],
            conditions: { langues: ["en"] },
          },
        ],
      }),
      headers: auth(token),
    });

    expect(res.status).toBe(400);
  });

  it("refuse abTest sur une variante unique", async () => {
    const token = await login("routing16@example.com");
    const qr = await createQr(token);

    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config({
        regles: [
          {
            id: "r_ab",
            priorite: 10,
            varianteId: "v_en",
            conditions: { abTest: true },
          },
        ],
      }),
      headers: auth(token),
    });

    expect(res.status).toBe(400);
  });
});
