import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { RoutingConfig, RoutingStatsResult } from "@free-qr/shared-types";
import { recordScan } from "../src/services/scan.js";
import type { ContexteScan } from "../src/services/context.js";
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

describe("GET /qrcodes/:id/routage/stats", () => {
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

  async function createQr(
    token: string,
    cfg?: RoutingConfig,
  ): Promise<{ id: string; qrId: number }> {
    const res = await makeRequest(app, ctx.env, "POST", "/qrcodes", {
      body: { type: "dynamique", contenu: "https://example.com/base", typeContenu: "url" },
      headers: { Authorization: `Bearer ${token}` },
    });
    const qr = (await res.json()) as { id: string };

    if (cfg) {
      const put = await makeRequest(app, ctx.env, "PUT", `/qrcodes/${qr.id}/routage`, {
        body: cfg,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(put.status).toBe(200);
    }

    return { id: qr.id, qrId: Number(qr.id) };
  }

  let ipCounter = 0;

  async function seedScan(
    qrId: number,
    options: {
      variante?: string | null;
      langue?: string;
      pays?: string;
      date?: Date;
    } = {},
  ): Promise<void> {
    ipCounter += 1;
    const contexte: ContexteScan = {
      maintenant: options.date ?? new Date(),
      pays: options.pays ?? "CG",
      ville: "Brazzaville",
      appareil: "mobile",
      langue: options.langue ?? "fr",
      scansTotal: 0,
    };
    await recordScan(
      ctx.env,
      { id: qrId } as Parameters<typeof recordScan>[1],
      { ip: `203.0.${ipCounter}.45`, userAgent: "Mozilla/5.0 (iPhone)" },
      contexte,
      options.variante ?? null,
    );
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it("agrège les scans par variante avec parts et langues", async () => {
    const token = await login("stats1@example.com");
    const qr = await createQr(token, config());
    const date = new Date("2026-11-11T10:00:00.000Z");

    for (let i = 0; i < 3; i++) {
      await seedScan(qr.qrId, { variante: "v_en", langue: "en", date });
    }
    await seedScan(qr.qrId, { variante: "v_fr", langue: "fr", date });
    await seedScan(qr.qrId, { variante: null, langue: "fr", date });
    await seedScan(qr.qrId, { variante: null, langue: "fr", date });

    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/qrcodes/${qr.id}/routage/stats?from=2026-11-11&to=2026-11-11`,
      { headers: auth(token) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as RoutingStatsResult;

    expect(body.totalScans).toBe(6);
    expect(body.variantes.map((v) => v.varianteId)).toEqual(["v_en", null, "v_fr"]);

    const en = body.variantes[0];
    expect(en).toMatchObject({
      libelle: "Profil EN",
      scans: 3,
      scansUniques: 3,
      supprimee: false,
    });
    expect(en.part).toBeCloseTo(0.5, 5);
    expect(en.langues).toEqual({ en: 3 });

    const fr = body.variantes[2];
    expect(fr.part).toBeCloseTo(1 / 6, 5);
    expect(fr.langues).toEqual({ fr: 1 });

    const sansRoutage = body.variantes[1];
    expect(sansRoutage.libelle).toBe("Sans routage");
    expect(sansRoutage.scans).toBe(2);
  });

  it("affiche une variante supprimée avec son id brut, jamais masquée", async () => {
    const token = await login("stats2@example.com");
    const qr = await createQr(token, config());
    const date = new Date("2026-11-11T10:00:00.000Z");

    await seedScan(qr.qrId, { variante: "v_ancienne", langue: "en", date });

    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/qrcodes/${qr.id}/routage/stats?from=2026-11-11&to=2026-11-11`,
      { headers: auth(token) },
    );

    const body = (await res.json()) as RoutingStatsResult;
    expect(body.variantes[0]).toMatchObject({
      varianteId: "v_ancienne",
      libelle: "v_ancienne",
      supprimee: true,
    });
  });

  it("renvoie une période vide sans erreur", async () => {
    const token = await login("stats3@example.com");
    const qr = await createQr(token, config());

    const res = await makeRequest(app, ctx.env, "GET", `/qrcodes/${qr.id}/routage/stats`, {
      headers: auth(token),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as RoutingStatsResult;
    expect(body.totalScans).toBe(0);
    expect(body.variantes).toEqual([]);
  });

  it("regroupe tout sous « Sans routage » pour un QR sans configuration", async () => {
    const token = await login("stats4@example.com");
    const qr = await createQr(token);
    const date = new Date("2026-11-11T10:00:00.000Z");

    await seedScan(qr.qrId, { variante: null, date });

    const res = await makeRequest(app, ctx.env, "GET", `/qrcodes/${qr.id}/routage/stats`, {
      headers: auth(token),
    });

    const body = (await res.json()) as RoutingStatsResult;
    expect(body.variantes).toHaveLength(1);
    expect(body.variantes[0]).toMatchObject({ varianteId: null, libelle: "Sans routage", scans: 1 });
    expect(body.alertes).toEqual([]);
  });

  it("refuse une période inversée", async () => {
    const token = await login("stats5@example.com");
    const qr = await createQr(token, config());

    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/qrcodes/${qr.id}/routage/stats?from=2026-11-12&to=2026-11-11`,
      { headers: auth(token) },
    );

    expect(res.status).toBe(400);
  });

  it("isole les comptes (QR d'un autre utilisateur → 404)", async () => {
    const tokenA = await login("stats6a@example.com");
    const qr = await createQr(tokenA, config());
    const tokenB = await login("stats6b@example.com");

    const res = await makeRequest(app, ctx.env, "GET", `/qrcodes/${qr.id}/routage/stats`, {
      headers: auth(tokenB),
    });

    expect(res.status).toBe(404);
  });

  it("alerte sur une variante sans scan sur 7 jours quand le QR a du trafic", async () => {
    const token = await login("stats7@example.com");
    const qr = await createQr(token, config());

    // Seule la variante FR reçoit du trafic récent.
    await seedScan(qr.qrId, { variante: "v_fr", langue: "fr" });
    await seedScan(qr.qrId, { variante: "v_fr", langue: "fr" });

    const res = await makeRequest(app, ctx.env, "GET", `/qrcodes/${qr.id}/routage/stats`, {
      headers: auth(token),
    });

    const body = (await res.json()) as RoutingStatsResult;
    expect(body.alertes).toHaveLength(1);
    expect(body.alertes[0]).toMatchObject({
      type: "variante_morte",
      varianteId: "v_en",
      libelle: "Profil EN",
    });
  });

  it("exporte le CSV avec séparateur point-virgule", async () => {
    const token = await login("stats8@example.com");
    const qr = await createQr(token, config());
    const date = new Date("2026-11-11T10:00:00.000Z");

    await seedScan(qr.qrId, { variante: "v_en", langue: "en", date });
    await seedScan(qr.qrId, { variante: "v_fr", langue: "fr", date });

    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      `/qrcodes/${qr.id}/routage/stats.csv?from=2026-11-11&to=2026-11-11`,
      { headers: auth(token) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");

    const lignes = (await res.text()).split("\r\n");
    expect(lignes[0]).toBe("destination;variante_id;scans;scans_uniques;part;langues;pays");
    expect(lignes[1]).toBe("Profil EN;v_en;1;1;50.0%;en=1;CG=1");
  });
});
