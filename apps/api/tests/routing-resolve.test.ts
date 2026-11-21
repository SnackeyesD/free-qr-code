import { describe, it, expect } from "vitest";
import type { RoutingConfig } from "@free-qr/shared-types";
import {
  dansPlage,
  hashStable,
  heureLocale,
  resoudreVariante,
  resoudreVarianteDetaillee,
  tirerVariante,
} from "../src/services/routing/resolve.js";
import type { ContexteScan } from "../src/services/context.js";

function ctx(overrides: Partial<ContexteScan> = {}): ContexteScan {
  return {
    maintenant: new Date("2026-11-11T12:00:00.000Z"), // mercredi
    pays: "CG",
    ville: "Brazzaville",
    appareil: "mobile",
    langue: "fr",
    scansTotal: 0,
    ...overrides,
  };
}

function config(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    version: 1,
    actif: true,
    fuseau: "Africa/Brazzaville",
    defaut: "v_fr",
    variantes: [
      { id: "v_fr", libelle: "Portfolio FR", typeSortie: "url", contenu: "https://e.test/fr" },
      { id: "v_en", libelle: "Portfolio EN", typeSortie: "url", contenu: "https://e.test/en" },
      { id: "v_call", libelle: "Prise de contact", typeSortie: "url", contenu: "https://e.test/appel" },
    ],
    regles: [
      { id: "r_en", priorite: 10, varianteId: "v_en", conditions: { langues: ["en"] } },
    ],
    ...overrides,
  };
}

describe("heureLocale", () => {
  it("calcule le jour et les minutes dans le fuseau du QR", () => {
    const date = new Date("2026-11-11T12:00:00.000Z");
    expect(heureLocale(date, "Africa/Brazzaville")).toEqual({ jour: 3, minutes: 13 * 60 });
    expect(heureLocale(date, "UTC")).toEqual({ jour: 3, minutes: 12 * 60 });
  });

  it("distingue deux fuseaux a la meme date (ete)", () => {
    const ete = new Date("2026-07-01T12:00:00.000Z");
    expect(heureLocale(ete, "Africa/Brazzaville").minutes).toBe(13 * 60);
    expect(heureLocale(ete, "Europe/Paris").minutes).toBe(14 * 60);
  });

  it("retombe sur UTC si le fuseau est invalide", () => {
    expect(heureLocale(new Date("2026-11-11T12:00:00.000Z"), "Mars/Olympus")).toEqual({
      jour: 3,
      minutes: 12 * 60,
    });
  });
});

describe("dansPlage", () => {
  it("gere une plage classique (bornes min incluse, max exclue)", () => {
    expect(dansPlage(12 * 60, "11:30", "15:00")).toBe(true);
    expect(dansPlage(11 * 60, "11:30", "15:00")).toBe(false);
    expect(dansPlage(15 * 60, "11:30", "15:00")).toBe(false);
  });

  it("gere le passage a minuit", () => {
    expect(dansPlage(23 * 60 + 30, "22:00", "02:00")).toBe(true);
    expect(dansPlage(1 * 60 + 30, "22:00", "02:00")).toBe(true);
    expect(dansPlage(3 * 60, "22:00", "02:00")).toBe(false);
    expect(dansPlage(12 * 60, "22:00", "02:00")).toBe(false);
  });
});

describe("resoudreVariante", () => {
  it("retombe sur le fallback si aucune configuration", () => {
    expect(resoudreVariante(null, ctx()).variante).toBeNull();
    expect(resoudreVariante(undefined, ctx()).variante).toBeNull();
  });

  it("ne route pas une configuration inactive", () => {
    const res = resoudreVariante(config({ actif: false }), ctx());
    expect(res.variante).toBeNull();
    expect(res.raison).toContain("inactive");
  });

  it("ne casse pas si la variante par defaut a disparu", () => {
    const res = resoudreVariante(config({ defaut: "inconnue" }), ctx());
    expect(res.variante).toBeNull();
    expect(res.raison).toContain("introuvable");
  });

  it("sert la variante par defaut si aucune regle ne correspond", () => {
    const res = resoudreVariante(config(), ctx({ langue: "fr" }));
    expect(res.variante?.id).toBe("v_fr");
    expect(res.regleId).toBeNull();
  });

  it("applique une regle de langue", () => {
    const res = resoudreVariante(config(), ctx({ langue: "en" }));
    expect(res.variante?.id).toBe("v_en");
    expect(res.regleId).toBe("r_en");
  });

  it("ne devine pas quand la langue est inconnue", () => {
    const res = resoudreVariante(config(), ctx({ langue: undefined }));
    expect(res.variante?.id).toBe("v_fr");
    expect(res.regleId).toBeNull();
  });

  it("respecte l'ordre de priorite, pas l'ordre du tableau", () => {
    const cfg = config({
      regles: [
        { id: "r_fr", priorite: 20, varianteId: "v_fr", conditions: { pays: ["CG"] } },
        { id: "r_en", priorite: 10, varianteId: "v_en", conditions: { langues: ["en"] } },
      ],
    });
    expect(resoudreVariante(cfg, ctx({ langue: "en" })).regleId).toBe("r_en");
  });

  it("applique une plage horaire dans le fuseau du QR", () => {
    const cfg = config({
      regles: [
        {
          id: "r_midi",
          priorite: 10,
          varianteId: "v_call",
          conditions: { heureMin: "12:00", heureMax: "14:00" },
        },
      ],
    });
    // 12:00 UTC = 13:00 a Brazzaville → dans la plage
    expect(resoudreVariante(cfg, ctx()).variante?.id).toBe("v_call");
    // 10:00 UTC = 11:00 a Brazzaville → hors plage
    expect(
      resoudreVariante(cfg, ctx({ maintenant: new Date("2026-11-11T10:00:00.000Z") })).variante?.id,
    ).toBe("v_fr");
  });

  it("filtre par jour de la semaine", () => {
    const cfg = config({
      regles: [
        {
          id: "r_we",
          priorite: 10,
          varianteId: "v_en",
          conditions: { jours: [6, 7] },
        },
      ],
    });
    expect(resoudreVariante(cfg, ctx()).variante?.id).toBe("v_fr"); // mercredi
    expect(
      resoudreVariante(cfg, ctx({ maintenant: new Date("2026-11-14T12:00:00.000Z") })).variante?.id,
    ).toBe("v_en"); // samedi
  });

  it("filtre par pays", () => {
    const cfg = config({
      regles: [
        { id: "r_cg", priorite: 10, varianteId: "v_call", conditions: { pays: ["CG"] } },
      ],
    });
    expect(resoudreVariante(cfg, ctx({ pays: "CG" })).variante?.id).toBe("v_call");
    expect(resoudreVariante(cfg, ctx({ pays: "FR" })).variante?.id).toBe("v_fr");
    expect(resoudreVariante(cfg, ctx({ pays: undefined })).variante?.id).toBe("v_fr");
  });

  it("filtre par appareil", () => {
    const cfg = config({
      regles: [
        { id: "r_mob", priorite: 10, varianteId: "v_call", conditions: { appareil: ["mobile"] } },
      ],
    });
    expect(resoudreVariante(cfg, ctx({ appareil: "mobile" })).variante?.id).toBe("v_call");
    expect(resoudreVariante(cfg, ctx({ appareil: "desktop" })).variante?.id).toBe("v_fr");
  });

  it("gere les bornes min/max de scans", () => {
    const cfg = config({
      regles: [
        { id: "r_min", priorite: 10, varianteId: "v_call", conditions: { minScansTotal: 10 } },
        { id: "r_max", priorite: 20, varianteId: "v_en", conditions: { maxScansTotal: 3 } },
      ],
    });
    expect(resoudreVariante(cfg, ctx({ scansTotal: 0 })).variante?.id).toBe("v_en");
    expect(resoudreVariante(cfg, ctx({ scansTotal: 3 })).variante?.id).toBe("v_fr");
    expect(resoudreVariante(cfg, ctx({ scansTotal: 10 })).variante?.id).toBe("v_call");
  });

  it("ignore une regle pointant vers une variante supprimee", () => {
    const cfg = config({
      regles: [
        { id: "r_ghost", priorite: 10, varianteId: "v_supprimee", conditions: { langues: ["en"] } },
        { id: "r_en", priorite: 20, varianteId: "v_en", conditions: { langues: ["en"] } },
      ],
    });
    expect(resoudreVariante(cfg, ctx({ langue: "en" })).regleId).toBe("r_en");
  });

  it("est deterministe a contexte egal", () => {
    const cfg = config();
    const c = ctx({ langue: "en" });
    expect(resoudreVariante(cfg, c)).toEqual(resoudreVariante(cfg, c));
  });

  it("expose la trace des regles dans la version detaillee", () => {
    const { resolution, etapes } = resoudreVarianteDetaillee(config(), ctx({ langue: "fr" }));
    expect(resolution.variante?.id).toBe("v_fr");
    expect(etapes).toHaveLength(1);
    expect(etapes[0]).toMatchObject({
      regleId: "r_en",
      correspond: false,
      motif: "langue fr hors de [en]",
    });
  });

  it("filtre par ville, sans tenir compte de la casse ni des accents", () => {
    const cfg = config({
      regles: [
        {
          id: "r_ville",
          priorite: 10,
          varianteId: "v_call",
          conditions: { villes: ["Brazzaville"] },
        },
      ],
    });
    expect(resoudreVariante(cfg, ctx({ ville: "brazzaville" })).variante?.id).toBe("v_call");
    expect(resoudreVariante(cfg, ctx({ ville: "Brazzavílle" })).variante?.id).toBe("v_call");
    expect(resoudreVariante(cfg, ctx({ ville: "Pointe-Noire" })).variante?.id).toBe("v_fr");
    // Ville inconnue : on ne devine pas.
    expect(resoudreVariante(cfg, ctx({ ville: undefined })).variante?.id).toBe("v_fr");
  });

  it("applique une fenêtre de dates inclusive", () => {
    const cfg = config({
      regles: [
        {
          id: "r_dates",
          priorite: 10,
          varianteId: "v_call",
          conditions: {
            dates: { debut: "2026-11-11T00:00:00.000Z", fin: "2026-11-11T23:59:59.999Z" },
          },
        },
      ],
    });
    const dedans = ctx({ maintenant: new Date("2026-11-11T12:00:00.000Z") });
    const dehors = ctx({ maintenant: new Date("2026-11-12T00:00:00.000Z") });
    expect(resoudreVariante(cfg, dedans).variante?.id).toBe("v_call");
    expect(resoudreVariante(cfg, dehors).variante?.id).toBe("v_fr");
  });

  it("tire une variante A/B de façon déterministe", () => {
    const cfg = config({
      regles: [
        {
          id: "r_ab",
          priorite: 10,
          varianteId: ["v_fr", "v_en"],
          conditions: { abTest: true },
        },
      ],
    });
    const contexte = ctx({ graine: "203.0.113.0|Mozilla/5.0|abc" });

    const premier = resoudreVariante(cfg, contexte).variante?.id;
    const second = resoudreVariante(cfg, contexte).variante?.id;

    expect(premier).toBe(second);
    expect(["v_fr", "v_en"]).toContain(premier);
    expect(resoudreVariante(cfg, contexte).raison).toContain("A/B");
  });
});

describe("tirage pondéré A/B", () => {
  const variantes = [
    { id: "v_a", libelle: "A", typeSortie: "url" as const, contenu: "https://e.test/a", poids: 70 },
    { id: "v_b", libelle: "B", typeSortie: "url" as const, contenu: "https://e.test/b", poids: 30 },
  ];

  it("répartit 70/30 sur un grand nombre de graines", () => {
    const compte: Record<string, number> = { v_a: 0, v_b: 0 };
    const total = 10_000;

    for (let i = 0; i < total; i++) {
      compte[tirerVariante(variantes, `graine-${i}`).id] += 1;
    }

    expect(compte.v_a / total).toBeGreaterThan(0.67);
    expect(compte.v_a / total).toBeLessThan(0.73);
  });

  it("renvoie toujours la même variante pour une graine donnée", () => {
    const graine = "203.0.113.0|Mozilla/5.0|abc";
    expect(tirerVariante(variantes, graine).id).toBe(tirerVariante(variantes, graine).id);
  });

  it("hashStable reste dans les 32 bits non signés", () => {
    expect(hashStable("abc")).toBe(hashStable("abc"));
    expect(hashStable("abc")).toBeGreaterThanOrEqual(0);
    expect(hashStable("abc")).toBeLessThanOrEqual(0xffffffff);
  });
});
