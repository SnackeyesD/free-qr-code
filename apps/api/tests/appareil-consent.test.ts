import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { RoutingConfig } from "@free-qr/shared-types";
import {
  createTestApp,
  createTestEnv,
  createVerifiedUser,
  makeRequest,
  type TestContext,
} from "./setup.js";
import {
  COOKIE_APPAREIL,
  COOKIE_COMPTEUR,
  COOKIE_REFUS,
  configNecessiteConsentement,
  hashAppareil,
  incrementerCompteur,
  lireCompteur,
} from "../src/services/appareil.js";
import { resoudreVariante } from "../src/services/routing/resolve.js";
import type { ContexteScan } from "../src/services/context.js";

const app = createTestApp();

function configAppareil(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    version: 1,
    actif: true,
    fuseau: "Africa/Brazzaville",
    defaut: "v_defaut",
    variantes: [
      {
        id: "v_defaut",
        libelle: "Défaut",
        typeSortie: "url",
        contenu: "https://e.test/base",
      },
      {
        id: "v_fidele",
        libelle: "Fidèle",
        typeSortie: "url",
        contenu: "https://e.test/fidele",
      },
    ],
    regles: [
      {
        id: "r_fidele",
        priorite: 10,
        varianteId: "v_fidele",
        conditions: { minScansAppareil: 3 },
      },
    ],
    ...overrides,
  };
}

function contexte(scansAppareil?: number): ContexteScan {
  return {
    maintenant: new Date("2026-11-12T10:00:00.000Z"),
    appareil: "mobile",
    scansTotal: 0,
    scansAppareil,
    consentementAppareil: scansAppareil !== undefined,
  };
}

function setCookies(res: Response): string[] {
  const entetes = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof entetes.getSetCookie === "function") return entetes.getSetCookie();
  const brut = res.headers.get("set-cookie");
  return brut ? [brut] : [];
}

function cookie(res: Response, nom: string): string | undefined {
  return setCookies(res).find((valeur) => valeur.startsWith(`${nom}=`));
}

function valeurCookie(res: Response, nom: string): string | undefined {
  const entete = cookie(res, nom);
  const valeur = entete?.split(";")[0]?.split("=")[1];
  return valeur === undefined ? undefined : decodeURIComponent(valeur);
}

describe("compteur par appareil — helpers", () => {
  it("parse et incrémente un cookie compteur multi-QR", () => {
    expect(lireCompteur(undefined, "abc1234")).toBe(0);
    expect(lireCompteur("abc1234:2", "abc1234")).toBe(2);
    expect(lireCompteur("abc1234:2~def5678:5", "def5678")).toBe(5);
    expect(lireCompteur("corrompu", "abc1234")).toBe(0);
    expect(lireCompteur("abc1234:-2", "abc1234")).toBe(0);

    expect(incrementerCompteur(undefined, "abc1234")).toBe("abc1234:1");
    expect(incrementerCompteur("abc1234:2", "abc1234")).toBe("abc1234:3");
    expect(incrementerCompteur("abc1234:2~def5678:5", "abc1234")).toBe(
      "def5678:5~abc1234:3",
    );
  });

  it("hash : même identifiant → même hash, jamais l'UUID brut", async () => {
    const uuid = "11111111-2222-4333-8444-555555555555";
    const secret = "test-tracking-secret-min-32-bytes-";
    const premier = await hashAppareil(uuid, secret);
    const second = await hashAppareil(uuid, secret);
    const autre = await hashAppareil(
      "99999999-8888-4777-8666-555555555555",
      secret,
    );

    expect(premier).toBe(second);
    expect(premier).not.toBe(autre);
    expect(premier).toHaveLength(32);
    expect(premier).not.toContain(uuid);
  });

  it("détecte les conditions appareil, uniquement si le routage est actif", () => {
    expect(configNecessiteConsentement(configAppareil())).toBe(true);
    expect(configNecessiteConsentement(configAppareil({ actif: false }))).toBe(false);
    expect(
      configNecessiteConsentement({
        ...configAppareil(),
        regles: [
          {
            id: "r_lang",
            priorite: 10,
            varianteId: "v_fidele",
            conditions: { langues: ["en"] },
          },
        ],
      }),
    ).toBe(false);
  });

  it("résolveur : appareil inconnu ou refus → la règle ne correspond pas", () => {
    const config = configAppareil();

    const inconnu = resoudreVariante(config, contexte());
    expect(inconnu.variante?.id).toBe("v_defaut");

    const premierScan = resoudreVariante(config, contexte(1));
    expect(premierScan.variante?.id).toBe("v_defaut");

    const troisiemeScan = resoudreVariante(config, contexte(3));
    expect(troisiemeScan.variante?.id).toBe("v_fidele");
  });

  it("résolveur : maxScansAppareil exclut la borne atteinte", () => {
    const config = configAppareil({
      regles: [
        {
          id: "r_max",
          priorite: 10,
          varianteId: "v_fidele",
          conditions: { maxScansAppareil: 2 },
        },
      ],
    });

    expect(resoudreVariante(config, contexte(1)).variante?.id).toBe("v_fidele");
    expect(resoudreVariante(config, contexte(2)).variante?.id).toBe("v_defaut");
  });
});

describe("GET /q/:alias — consentement et comptage par appareil", () => {
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

  async function createDynamicQr(
    token: string,
  ): Promise<{ id: string; aliasCourt: string }> {
    const res = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: {
        type: "dynamique",
        contenu: "https://example.com/base",
        typeContenu: "url",
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    return (await res.json()) as { id: string; aliasCourt: string };
  }

  async function sauver(
    token: string,
    qrId: string,
    config: RoutingConfig,
  ): Promise<void> {
    const res = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qrId}/routage`, {
      body: config,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status, await res.clone().text()).toBe(200);
  }

  it("QR sans règle appareil : aucun cookie, aucun interstitiel", async () => {
    const token = await login("app1@example.com");
    const qr = await createDynamicQr(token);

    const res = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/base");
    expect(setCookies(res)).toHaveLength(0);
  });

  it("QR sans règle appareil : ne pose pas de compteur même avec un consentement existant", async () => {
    const token = await login("app2@example.com");
    const qr = await createDynamicQr(token);
    const uuid = crypto.randomUUID();

    const res = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      cookies: `${COOKIE_APPAREIL}=${uuid}`,
    });

    expect(res.status).toBe(302);
    expect(setCookies(res)).toHaveLength(0);
  });

  it("premier scan d'un QR concerné : redirige vers /c/:alias sans poser de cookie", async () => {
    const token = await login("app3@example.com");
    const qr = await createDynamicQr(token);
    await sauver(token, qr.id, configAppareil());

    const res = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(new RegExp(`/c/${qr.aliasCourt}$`));
    expect(cookie(res, COOKIE_APPAREIL)).toBeUndefined();
  });

  it("la page de consentement est légère, sans indexation et propose Refuser", async () => {
    const token = await login("app4@example.com");
    const qr = await createDynamicQr(token);
    await sauver(token, qr.id, configAppareil());

    const res = await makeRequest(app, ctx.env, "GET", `/c/${qr.aliasCourt}`);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain("Accepter");
    expect(html).toContain("Refuser");
    expect(html).toContain('name="robots" content="noindex');
    expect(Buffer.byteLength(html, "utf8")).toBeLessThan(10_000);
  });

  it("acceptation : cookie HttpOnly/Secure/SameSite=Lax et preuve hashée en base", async () => {
    const token = await login("app5@example.com");
    const qr = await createDynamicQr(token);
    await sauver(token, qr.id, configAppareil());

    const res = await makeRequest(
      app,
      ctx.env,
      "POST",
      `/c/${qr.aliasCourt}/accepter`,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(
      new RegExp(`/q/${qr.aliasCourt}\\?cfq_decision=accept$`),
    );

    const entete = cookie(res, COOKIE_APPAREIL);
    expect(entete).toBeDefined();
    expect(entete).toMatch(/HttpOnly/i);
    expect(entete).toMatch(/Secure/i);
    expect(entete).toMatch(/SameSite=Lax/i);
    expect(entete).toMatch(/Max-Age=/i);

    const uuid = valeurCookie(res, COOKIE_APPAREIL)!;
    const hash = await hashAppareil(uuid, ctx.env.JWT_TRACKING_SECRET);

    const preuve = ctx.db
      .prepare(
        `SELECT id_appareil, finalite, version_texte, date_retrait
         FROM consentements`,
      )
      .get() as {
      id_appareil: string;
      finalite: string;
      version_texte: string;
      date_retrait: string | null;
    };

    expect(preuve.id_appareil).toBe(hash);
    expect(preuve.id_appareil).not.toBe(uuid);
    expect(preuve.finalite).toBe("comptage_appareil");
    expect(preuve.version_texte).toBe("v1-2026-11");
    expect(preuve.date_retrait).toBeNull();

    // Aucun UUID brut ne doit apparaître dans les tables du mécanisme.
    const brut = ctx.db
      .prepare(
        `SELECT COUNT(*) AS total FROM consentements WHERE id_appareil = ?
         UNION ALL
         SELECT COUNT(*) FROM appareils_qr WHERE id_appareil = ?
         UNION ALL
         SELECT COUNT(*) FROM scans WHERE id_appareil = ?`,
      )
      .all(uuid, uuid, uuid) as Array<{ total: number }>;
    expect(brut.every((ligne) => ligne.total === 0)).toBe(true);
  });

  it("3ᵉ scan avec consentement : la variante « fidèle » est servie", async () => {
    const token = await login("app6@example.com");
    const qr = await createDynamicQr(token);
    await sauver(token, qr.id, configAppareil());
    const uuid = crypto.randomUUID();

    const premier = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      cookies: `${COOKIE_APPAREIL}=${uuid}`,
    });
    expect(premier.headers.get("location")).toBe("https://e.test/base?cfq=v_defaut");

    const troisieme = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      cookies: `${COOKIE_APPAREIL}=${uuid}; ${COOKIE_COMPTEUR}=${qr.aliasCourt}:2`,
    });

    expect(troisieme.status).toBe(302);
    expect(troisieme.headers.get("location")).toBe(
      "https://e.test/fidele?cfq=v_fidele",
    );
    expect(valeurCookie(troisieme, COOKIE_COMPTEUR)).toBe(`${qr.aliasCourt}:3`);
  });

  it("refus : cookie de refus, aucune condition appareil appliquée", async () => {
    const token = await login("app7@example.com");
    const qr = await createDynamicQr(token);
    await sauver(token, qr.id, configAppareil());

    const refus = await makeRequest(
      app,
      ctx.env,
      "POST",
      `/c/${qr.aliasCourt}/refuser`,
    );
    expect(refus.status).toBe(302);
    expect(valeurCookie(refus, COOKIE_REFUS)).toBe("1");
    expect(cookie(refus, COOKIE_APPAREIL)).toBeUndefined();

    const scan = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      cookies: `${COOKIE_REFUS}=1; ${COOKIE_COMPTEUR}=${qr.aliasCourt}:9`,
    });

    expect(scan.headers.get("location")).toBe("https://e.test/base?cfq=v_defaut");
    expect(cookie(scan, COOKIE_COMPTEUR)).toBeUndefined();
  });

  it("maxScansAppareil atteint : retour à la variante par défaut", async () => {
    const token = await login("app8@example.com");
    const qr = await createDynamicQr(token);
    await sauver(
      token,
      qr.id,
      configAppareil({
        regles: [
          {
            id: "r_max",
            priorite: 10,
            varianteId: "v_fidele",
            conditions: { maxScansAppareil: 2 },
          },
        ],
      }),
    );
    const uuid = crypto.randomUUID();

    const second = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      cookies: `${COOKIE_APPAREIL}=${uuid}; ${COOKIE_COMPTEUR}=${qr.aliasCourt}:1`,
    });
    expect(second.headers.get("location")).toBe("https://e.test/base?cfq=v_defaut");

    const premier = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      cookies: `${COOKIE_APPAREIL}=${uuid}`,
    });
    expect(premier.headers.get("location")).toBe("https://e.test/fidele?cfq=v_fidele");
  });

  it("retrait du consentement : cookie supprimé, preuve horodatée, historique délié", async () => {
    const token = await login("app9@example.com");
    const qr = await createDynamicQr(token);
    await sauver(token, qr.id, configAppareil());

    const acceptation = await makeRequest(
      app,
      ctx.env,
      "POST",
      `/c/${qr.aliasCourt}/accepter`,
    );
    const uuid = valeurCookie(acceptation, COOKIE_APPAREIL)!;
    const hash = await hashAppareil(uuid, ctx.env.JWT_TRACKING_SECRET);

    await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`, {
      cookies: `${COOKIE_APPAREIL}=${uuid}`,
    });

    const avant = ctx.db
      .prepare("SELECT COUNT(*) AS total FROM appareils_qr WHERE id_appareil = ?")
      .get(hash) as { total: number };
    expect(avant.total).toBe(1);

    const page = await makeRequest(app, ctx.env, "GET", "/consentement", {
      cookies: `${COOKIE_APPAREIL}=${uuid}`,
    });
    expect(await page.text()).toContain("Retirer mon consentement");

    const retrait = await makeRequest(
      app,
      ctx.env,
      "POST",
      "/consentement/retirer",
      { cookies: `${COOKIE_APPAREIL}=${uuid}` },
    );

    expect(retrait.status).toBe(302);
    expect(retrait.headers.get("location")).toMatch(/\/consentement\?retire=1$/);
    expect(cookie(retrait, COOKIE_APPAREIL)).toMatch(/Max-Age=0/i);

    const preuve = ctx.db
      .prepare("SELECT date_retrait FROM consentements WHERE id_appareil = ?")
      .get(hash) as { date_retrait: string | null };
    expect(preuve.date_retrait).not.toBeNull();

    const appareils = ctx.db
      .prepare("SELECT COUNT(*) AS total FROM appareils_qr WHERE id_appareil = ?")
      .get(hash) as { total: number };
    expect(appareils.total).toBe(0);

    const scans = ctx.db
      .prepare(
        `SELECT COUNT(*) AS total FROM scans
         WHERE id_qrcode = ? AND id_appareil IS NOT NULL`,
      )
      .get(Number(qr.id)) as { total: number };
    expect(scans.total).toBe(0);
  });

  it("après retrait, un nouveau scan redemande le consentement", async () => {
    const token = await login("app10@example.com");
    const qr = await createDynamicQr(token);
    await sauver(token, qr.id, configAppareil());

    const acceptation = await makeRequest(
      app,
      ctx.env,
      "POST",
      `/c/${qr.aliasCourt}/accepter`,
    );
    const uuid = valeurCookie(acceptation, COOKIE_APPAREIL)!;

    await makeRequest(app, ctx.env, "POST", "/consentement/retirer", {
      cookies: `${COOKIE_APPAREIL}=${uuid}`,
    });

    const res = await makeRequest(app, ctx.env, "GET", `/q/${qr.aliasCourt}`);
    expect(res.headers.get("location")).toMatch(new RegExp(`/c/${qr.aliasCourt}$`));
  });
});
