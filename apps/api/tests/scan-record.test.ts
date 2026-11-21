import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestEnv, createVerifiedUser, type TestContext } from "./setup.js";
import { recordScan } from "../src/services/scan.js";
import type { ContexteScan } from "../src/services/context.js";

type QRCodeRow = Parameters<typeof recordScan>[1];

async function insererQr(env: TestContext["env"], idUtilisateur: number): Promise<number> {
  const result = await env.DB.prepare(
    `INSERT INTO qrcodes (public_id, id_utilisateur, contenu, type_contenu, est_dynamique, alias_court, parametres)
     VALUES (?, ?, ?, 'url', 1, ?, '{}')`,
  )
    .bind(crypto.randomUUID(), idUtilisateur, "https://example.com", `alias${idUtilisateur}`)
    .run();
  return result.meta?.last_row_id ?? 0;
}

function contexte(pays?: string): ContexteScan {
  return {
    maintenant: new Date("2026-11-11T10:00:00.000Z"),
    pays,
    ville: pays ? "Brazzaville" : undefined,
    appareil: "mobile",
    langue: "fr",
    scansTotal: 0,
  };
}

describe("recordScan", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  async function seed(): Promise<number> {
    const user = await createVerifiedUser(ctx.env, "scan@example.com", "StrongPass123!", "Scan");
    return insererQr(ctx.env, Number(user.id));
  }

  it("enregistre le pays fourni par request.cf sans appel reseau", async () => {
    const qrId = await seed();

    await recordScan(
      ctx.env,
      { id: qrId } as QRCodeRow,
      { ip: "203.0.113.45", userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      contexte("CG"),
    );

    const scan = ctx.db
      .prepare("SELECT adresse_ip, pays, ville, est_unique FROM scans WHERE id_qrcode = ?")
      .get(qrId) as { adresse_ip: string; pays: string; ville: string; est_unique: number };

    expect(scan.adresse_ip).toBe("203.0.113.0");
    expect(scan.pays).toBe("CG");
    expect(scan.ville).toBe("Brazzaville");
    expect(scan.est_unique).toBe(1);
  });

  it("ne casse pas quand request.cf est absent (dev local)", async () => {
    const qrId = await seed();

    await recordScan(
      ctx.env,
      { id: qrId } as QRCodeRow,
      { ip: "203.0.113.45", userAgent: "curl/8.0" },
      contexte(undefined),
    );

    const scan = ctx.db
      .prepare("SELECT pays, ville FROM scans WHERE id_qrcode = ?")
      .get(qrId) as { pays: string | null; ville: string | null };

    expect(scan.pays).toBeNull();
    expect(scan.ville).toBeNull();
  });

  it("agrege les compteurs et conserve les tops (regression pays_top)", async () => {
    const qrId = await seed();
    const info = { ip: "203.0.113.45", userAgent: "Mozilla/5.0 (Linux; Android 14)" };

    await recordScan(ctx.env, { id: qrId } as QRCodeRow, info, contexte("CG"));
    await recordScan(ctx.env, { id: qrId } as QRCodeRow, info, contexte("CG"));
    await recordScan(
      ctx.env,
      { id: qrId } as QRCodeRow,
      { ...info, ip: "198.51.100.7" },
      contexte("FR"),
    );

    const stats = ctx.db
      .prepare(
        "SELECT nombre_scans, nombre_scans_uniques, pays_top, appareils_top FROM statistiques_qrcodes WHERE id_qrcode = ?",
      )
      .get(qrId) as {
      nombre_scans: number;
      nombre_scans_uniques: number;
      pays_top: string;
      appareils_top: string;
    };

    expect(stats.nombre_scans).toBe(3);
    expect(stats.nombre_scans_uniques).toBe(2);
    expect(JSON.parse(stats.pays_top)).toEqual({ CG: 2, FR: 1 });
    expect(JSON.parse(stats.appareils_top)).toEqual({ Android: 3 });

    const qr = ctx.db
      .prepare("SELECT nombre_scans_total FROM qrcodes WHERE id = ?")
      .get(qrId) as { nombre_scans_total: number };
    expect(qr.nombre_scans_total).toBe(3);
  });

  it("ne duplique pas la ligne journaliere (upsert atomique)", async () => {
    const qrId = await seed();
    const info = { ip: "203.0.113.45", userAgent: "Mozilla/5.0 (iPhone)" };

    for (let i = 0; i < 5; i++) {
      await recordScan(ctx.env, { id: qrId } as QRCodeRow, info, contexte("CG"));
    }

    const rows = ctx.db
      .prepare("SELECT COUNT(*) AS n FROM statistiques_qrcodes WHERE id_qrcode = ?")
      .get(qrId) as { n: number };

    expect(rows.n).toBe(1);
  });

  it("marque non unique un second scan du meme jour et de la meme IP", async () => {
    const qrId = await seed();
    const info = { ip: "203.0.113.45", userAgent: "Mozilla/5.0 (iPhone)" };

    await recordScan(ctx.env, { id: qrId } as QRCodeRow, info, contexte("CG"));
    await recordScan(ctx.env, { id: qrId } as QRCodeRow, info, contexte("CG"));

    const uniques = ctx.db
      .prepare("SELECT est_unique FROM scans WHERE id_qrcode = ? ORDER BY id ASC")
      .all(qrId) as Array<{ est_unique: number }>;

    expect(uniques.map((s) => s.est_unique)).toEqual([1, 0]);
  });
});
