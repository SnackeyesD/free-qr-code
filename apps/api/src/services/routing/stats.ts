// services/routing/stats.ts
// Analytics par variante (phase 2).
// Source de verite : la table `scans`. Aucun compteur denormalise : on agrege
// a la lecture, ce qui evite toute desynchronisation.
import { HTTPException } from "hono/http-exception";
import type {
  RoutingConfig,
  RoutingStatsAlerte,
  RoutingStatsResult,
  RoutingVarianteStat,
} from "@free-qr/shared-types";
import { d1All, d1First } from "../../lib/db.js";
import type { AppEnv } from "../../types/index.js";
import { parseConfigRoutage } from "./config.js";

interface QRStatsRow {
  id: number;
  regles_routage: string | null;
}

interface LigneAgregee {
  varianteId: string | null;
  langue: string | null;
  pays: string | null;
  scans: number;
  scansUniques: number;
}

interface LigneSeptJours {
  varianteId: string | null;
  scans: number;
}

export interface RoutingStatsParams {
  from?: Date;
  to?: Date;
}

async function chargerQr(
  env: AppEnv["Bindings"],
  userId: string,
  qrId: string,
): Promise<QRStatsRow> {
  const id = Number(qrId);
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(id) || !Number.isFinite(idUtilisateur)) {
    throw new HTTPException(400, { message: "Invalid QR code id" });
  }

  const row = await d1First<QRStatsRow>(
    env,
    `SELECT id, regles_routage FROM qrcodes WHERE id = ? AND id_utilisateur = ?`,
    id,
    idUtilisateur,
  );
  if (!row) {
    throw new HTTPException(404, { message: "QR code not found" });
  }
  return row;
}

/**
 * Une seule passe : `GROUP BY id_variante, langue, pays`, agregation en JS.
 * `date_scan` est stocke en ISO 8601 : la comparaison lexicographique suffit.
 */
async function agreger(
  env: AppEnv["Bindings"],
  qrCodeId: number,
  params: RoutingStatsParams,
): Promise<LigneAgregee[]> {
  const conditions = ["id_qrcode = ?"];
  const bind: Array<string | number> = [qrCodeId];
  if (params.from) {
    conditions.push("date_scan >= ?");
    bind.push(params.from.toISOString());
  }
  if (params.to) {
    conditions.push("date_scan <= ?");
    bind.push(params.to.toISOString());
  }

  return d1All<LigneAgregee>(
    env,
    `SELECT id_variante AS varianteId,
            langue,
            pays,
            COUNT(*) AS scans,
            SUM(CASE WHEN est_unique = 1 THEN 1 ELSE 0 END) AS scansUniques
     FROM scans
     WHERE ${conditions.join(" AND ")}
     GROUP BY id_variante, langue, pays`,
    ...bind,
  );
}

async function variantesSansScanSeptJours(
  env: AppEnv["Bindings"],
  qrCodeId: number,
  maintenant: Date,
): Promise<{ lignes: LigneSeptJours[]; trafic: number }> {
  const depuis = new Date(maintenant.getTime() - 7 * 24 * 3600 * 1000);

  const lignes = await d1All<LigneSeptJours>(
    env,
    `SELECT id_variante AS varianteId, COUNT(*) AS scans
     FROM scans
     WHERE id_qrcode = ? AND date_scan >= ?
     GROUP BY id_variante`,
    qrCodeId,
    depuis.toISOString(),
  );

  return {
    lignes,
    trafic: lignes.reduce((total, ligne) => total + (ligne.scans ?? 0), 0),
  };
}

function libelleDe(config: RoutingConfig | null, varianteId: string): string | null {
  return config?.variantes.find((variante) => variante.id === varianteId)?.libelle ?? null;
}

function construireAlertes(
  config: RoutingConfig | null,
  lignesSeptJours: LigneSeptJours[],
  traficSeptJours: number,
): RoutingStatsAlerte[] {
  if (!config || !config.actif || traficSeptJours === 0) return [];

  const scansParVariante = new Map<string | null, number>();
  for (const ligne of lignesSeptJours) {
    scansParVariante.set(ligne.varianteId, ligne.scans ?? 0);
  }

  return config.variantes
    .filter((variante) => (scansParVariante.get(variante.id) ?? 0) === 0)
    .map((variante) => ({
      type: "variante_morte" as const,
      varianteId: variante.id,
      libelle: variante.libelle,
      message:
        `« ${variante.libelle} » n'a reçu aucun scan sur 7 jours alors que le QR ` +
        `en a reçu ${traficSeptJours} : vérifie ses conditions (langue, pays, horaire, appareil…).`,
    }));
}

export async function getRoutingStats(
  env: AppEnv["Bindings"],
  userId: string,
  qrId: string,
  params: RoutingStatsParams = {},
): Promise<RoutingStatsResult> {
  if (params.from && params.to && params.from.getTime() > params.to.getTime()) {
    throw new HTTPException(400, {
      message: "La date de début doit précéder la date de fin",
    });
  }

  const qr = await chargerQr(env, userId, qrId);
  const config = parseConfigRoutage(qr.regles_routage);
  const lignes = await agreger(env, qr.id, params);

  const parVariante = new Map<
    string | null,
    { scans: number; scansUniques: number; langues: Record<string, number>; pays: Record<string, number> }
  >();

  for (const ligne of lignes) {
    const cle = ligne.varianteId ?? null;
    const entree = parVariante.get(cle) ?? {
      scans: 0,
      scansUniques: 0,
      langues: {},
      pays: {},
    };
    entree.scans += ligne.scans ?? 0;
    entree.scansUniques += ligne.scansUniques ?? 0;
    if (ligne.langue) {
      entree.langues[ligne.langue] = (entree.langues[ligne.langue] ?? 0) + (ligne.scans ?? 0);
    }
    if (ligne.pays) {
      entree.pays[ligne.pays] = (entree.pays[ligne.pays] ?? 0) + (ligne.scans ?? 0);
    }
    parVariante.set(cle, entree);
  }

  const totalScans = [...parVariante.values()].reduce((total, v) => total + v.scans, 0);
  const scansUniques = [...parVariante.values()].reduce((total, v) => total + v.scansUniques, 0);

  const variantes: RoutingVarianteStat[] = [...parVariante.entries()].map(
    ([varianteId, entree]) => ({
      varianteId,
      libelle:
        varianteId === null
          ? "Sans routage"
          : libelleDe(config, varianteId) ?? varianteId,
      scans: entree.scans,
      scansUniques: entree.scansUniques,
      part: totalScans > 0 ? entree.scans / totalScans : 0,
      langues: entree.langues,
      pays: entree.pays,
      supprimee: varianteId !== null && libelleDe(config, varianteId) === null,
    }),
  );

  variantes.sort((a, b) => b.scans - a.scans || a.libelle.localeCompare(b.libelle));

  const septJours = await variantesSansScanSeptJours(env, qr.id, new Date());

  return {
    periode: {
      from: params.from?.toISOString().slice(0, 10),
      to: params.to?.toISOString().slice(0, 10),
    },
    totalScans,
    scansUniques,
    variantes,
    alertes: construireAlertes(config, septJours.lignes, septJours.trafic),
  };
}

function echapperCsv(valeur: string | number): string {
  const texte = String(valeur);
  return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

function formaterRepartition(repartition: Record<string, number>): string {
  return Object.entries(repartition)
    .sort((a, b) => b[1] - a[1])
    .map(([cle, valeur]) => `${cle}=${valeur}`)
    .join(" ");
}

/** Export CSV (separateur `;` pour Excel FR). Tries par scans decroissants. */
export function routingStatsToCsv(stats: RoutingStatsResult): string {
  const entetes = [
    "destination",
    "variante_id",
    "scans",
    "scans_uniques",
    "part",
    "langues",
    "pays",
  ];
  const lignes = stats.variantes.map((variante) =>
    [
      variante.libelle,
      variante.varianteId ?? "sans_routage",
      variante.scans,
      variante.scansUniques,
      `${(variante.part * 100).toFixed(1)}%`,
      formaterRepartition(variante.langues),
      formaterRepartition(variante.pays),
    ]
      .map(echapperCsv)
      .join(";"),
  );

  return [entetes.join(";"), ...lignes].join("\r\n");
}
