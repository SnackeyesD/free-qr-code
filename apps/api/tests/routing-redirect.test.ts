import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { RoutingConfig } from "@free-qr/shared-types";
import {
  createTestApp,
  createTestEnv,
  createVerifiedUser,
  makeRequest,
  type TestContext,
} from "./setup.js";
import { ajouterParametreSuivi } from "../src/routes/redirect.js";

const app = createTestApp();

function config(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    version: 1,
    actif: true,
    fuseau: "Africa/Brazzaville",
    defaut: "v_fr",
    variantes: [
      { id: "v_fr", libelle: "FR", typeSortie: "url", contenu: "https://e.test/fr" },
      { id: "v_en", libelle: "EN", typeSortie: "url", contenu: "https://e.test/en" },
    ],
    regles: [
      { id: "r_en", priorite: 10, varianteId: "v_en", conditions: { langues: ["en"] } },
    ],
    ...overrides,
  };
}

describe("GET /q/:alias — routage contextuel", () => {
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

  async function createDynamicQr(token: string): Promise<{ id: string; aliasCourt: string }> {
    const res = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: { type: "dynamique", contenu: "https://example.com/base", typeContenu: "url" },
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { id: string; aliasCourt: string };
    return body;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it("redirige vers la variante correspondant à la langue", async () => {
    const token = await login("redir1@example.com");
    const qr = await createDynamicQr(token);

    await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config(),
      headers: auth(token),
    });

    const res = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      headers: { "Accept-Language": "en-US,en;q=0.9,fr;q=0.8" },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://e.test/en?cfq=v_en");
  });

  it("sert le contenu d'origine sans configuration", async () => {
    const token = await login("redir2@example.com");
    const qr = await createDynamicQr(token);

    const res = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/base");
  });

  it("ne renvoie jamais de 5xx si le JSON de configuration est corrompu", async () => {
    const user = await createVerifiedUser(
      ctx.env,
      "redir3@example.com",
      "StrongPass123!",
      "Test",
    );

    ctx.db
      .prepare(
        `INSERT INTO qrcodes (public_id, id_utilisateur, contenu, type_contenu, est_dynamique, alias_court, parametres, regles_routage)
         VALUES (?, ?, ?, 'url', 1, 'corrupt1', '{}', ?)`,
      )
      .run(crypto.randomUUID(), Number(user.id), "https://example.com/fallback", "{oops");

    const res = await makeRequest(app, ctx.env, "GET", "/q/corrupt1");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/fallback");
  });

  it("ignore une configuration inactive", async () => {
    const token = await login("redir4@example.com");
    const qr = await createDynamicQr(token);

    await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: config({ actif: false }),
      headers: auth(token),
    });

    const res = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      headers: { "Accept-Language": "en" },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/base");
  });

  it("renvoie 404 pour un alias inconnu", async () => {
    const res = await makeRequest(app, ctx.env, "GET", "/q/nexistepas");
    expect(res.status).toBe(404);
  });

  it("ignore les QR statiques (pas d'alias dynamique)", async () => {
    const token = await login("redir5@example.com");
    const res = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: { type: "statique", contenu: "https://example.com/static", typeContenu: "url" },
      headers: auth(token),
    });
    const body = (await res.json()) as { aliasCourt?: string };
    expect(body.aliasCourt).toBeUndefined();
  });

  it("ajoute ?cfq=<variante> sans réécrire l'URL (query et ancre préservées)", () => {
    expect(ajouterParametreSuivi("https://e.test/profil", "v_en")).toBe(
      "https://e.test/profil?cfq=v_en",
    );
    expect(ajouterParametreSuivi("https://e.test/p?x=1#contact", "v_fr")).toBe(
      "https://e.test/p?x=1&cfq=v_fr#contact",
    );
  });

  it("A/B : deux scans du même appareil reçoivent la même variante", async () => {
    const token = await login("redir6@example.com");
    const qr = await createDynamicQr(token);
    const cfg = config({
      variantes: [
        { id: "v_fr", libelle: "FR", typeSortie: "url", contenu: "https://e.test/fr" },
        { id: "v_en", libelle: "EN", typeSortie: "url", contenu: "https://e.test/en" },
        { id: "v_ab_a", libelle: "A", typeSortie: "url", contenu: "https://e.test/a", poids: 70 },
        { id: "v_ab_b", libelle: "B", typeSortie: "url", contenu: "https://e.test/b", poids: 30 },
      ],
      regles: [
        {
          id: "r_ab",
          priorite: 10,
          varianteId: ["v_ab_a", "v_ab_b"],
          conditions: { abTest: true },
        },
      ],
    });

    const put = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
      body: cfg,
      headers: auth(token),
    });
    expect(put.status, await put.clone().text()).toBe(200);

    const premier = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone)" },
    });
    const second = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone)" },
    });

    expect(premier.headers.get("location")).toBe(second.headers.get("location"));
    expect(premier.headers.get("location")).toMatch(/https:\/\/e\.test\/(a|b)\?cfq=v_ab_(a|b)/);
  });
});
