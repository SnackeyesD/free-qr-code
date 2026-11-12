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

  it("sert une vCard dynamique en .vcf sans header Location", async () => {
    const user = await createVerifiedUser(
      ctx.env,
      "redir-vcard@example.com",
      "StrongPass123!",
      "Test",
    );

    const vcard =
      "BEGIN:VCARD\nVERSION:3.0\nFN:Gloire Messia SAYI\n" +
      "URL:https://momo-calc.getcongo.com/\nEND:VCARD";
    ctx.db
      .prepare(
        `INSERT INTO qrcodes (public_id, id_utilisateur, contenu, type_contenu, est_dynamique, alias_court, parametres)
         VALUES (?, ?, ?, 'vcard', 1, 'vcard-dyn', '{}')`,
      )
      .run(crypto.randomUUID(), Number(user.id), vcard);

    const res = await makeRequest(app, ctx.env, "GET", "/q/vcard-dyn");

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).toContain("text/vcard");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain(".vcf");

    const body = await res.text();
    expect(body).toContain("BEGIN:VCARD");
    expect(body).toContain("URL:https://momo-calc.getcongo.com/");
    expect(body).toContain("\r\n");

    const row = ctx.db
      .prepare("SELECT nombre_scans_total FROM qrcodes WHERE alias_court = ?")
      .get("vcard-dyn") as { nombre_scans_total: number };
    expect(row.nombre_scans_total).toBe(1);
  });

  it("sert un texte dynamique en text/plain", async () => {
    const user = await createVerifiedUser(
      ctx.env,
      "redir-texte@example.com",
      "StrongPass123!",
      "Test",
    );

    ctx.db
      .prepare(
        `INSERT INTO qrcodes (public_id, id_utilisateur, contenu, type_contenu, est_dynamique, alias_court, parametres)
         VALUES (?, ?, ?, 'texte', 1, 'texte-dyn', '{}')`,
      )
      .run(crypto.randomUUID(), Number(user.id), "Bonjour tout le monde");

    const res = await makeRequest(app, ctx.env, "GET", "/q/texte-dyn");

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("Bonjour tout le monde");
  });

  it("renvoie 404 pour une destination URL invalide (jamais 500)", async () => {
    const user = await createVerifiedUser(
      ctx.env,
      "redir-url-invalide@example.com",
      "StrongPass123!",
      "Test",
    );

    ctx.db
      .prepare(
        `INSERT INTO qrcodes (public_id, id_utilisateur, contenu, type_contenu, est_dynamique, alias_court, parametres)
         VALUES (?, ?, ?, 'url', 1, 'url-invalide', '{}')`,
      )
      .run(crypto.randomUUID(), Number(user.id), "javascript:alert(1)");

    const res = await makeRequest(app, ctx.env, "GET", "/q/url-invalide");

    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.text()).toContain("destination invalide");
  });

  it("ignore une variante non http(s) et sert le contenu natif (vCard)", async () => {
    const user = await createVerifiedUser(
      ctx.env,
      "redir-vcard-variante@example.com",
      "StrongPass123!",
      "Test",
    );

    const cfg = config({
      variantes: [
        { id: "v_fr", libelle: "FR", typeSortie: "url", contenu: "https://e.test/fr" },
        { id: "v_bad", libelle: "BAD", typeSortie: "url", contenu: "javascript:alert(1)" },
      ],
      regles: [
        {
          id: "r_bad",
          priorite: 10,
          varianteId: "v_bad",
          conditions: { langues: ["en"] },
        },
      ],
    });

    ctx.db
      .prepare(
        `INSERT INTO qrcodes (public_id, id_utilisateur, contenu, type_contenu, est_dynamique, alias_court, parametres, regles_routage)
         VALUES (?, ?, ?, 'vcard', 1, 'vcard-variante', '{}', ?)`,
      )
      .run(
        crypto.randomUUID(),
        Number(user.id),
        "BEGIN:VCARD\nVERSION:3.0\nFN:Test\nEND:VCARD",
        JSON.stringify(cfg),
      );

    const res = await makeRequest(app, ctx.env, "GET", "/q/vcard-variante", {
      headers: { "Accept-Language": "en" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).toContain("text/vcard");
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
