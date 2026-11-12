import { z } from "zod";

const REGEX_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

const varianteSchema = z.object({
  id: z.string().min(4).max(16),
  libelle: z.string().trim().min(1).max(60),
  typeSortie: z.literal("url"),
  // `z.string().url()` accepte `javascript:alert(1)` : on n'autorise que http(s).
  contenu: z
    .string()
    .url()
    .max(2048)
    .refine((v) => /^https?:\/\//i.test(v), "URL http(s) requise"),
  poids: z.number().int().min(1).max(100).optional(),
});

const conditionsSchema = z
  .object({
    jours: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
    heureMin: z.string().regex(REGEX_HEURE).optional(),
    heureMax: z.string().regex(REGEX_HEURE).optional(),
    pays: z
      .array(z.string().regex(/^[A-Z]{2}$/))
      .min(1)
      .max(50)
      .optional(),
    langues: z
      .array(z.string().regex(/^[a-z]{2}$/))
      .min(1)
      .max(10)
      .optional(),
    appareil: z.array(z.enum(["mobile", "tablet", "desktop"])).min(1).optional(),
    minScansTotal: z.number().int().min(0).optional(),
    maxScansTotal: z.number().int().min(1).optional(),
    /** Numéro de ce scan pour le même appareil (1 = premier scan). */
    minScansAppareil: z.number().int().min(1).max(1_000_000).optional(),
    maxScansAppareil: z.number().int().min(2).max(1_000_000).optional(),
    dates: z
      .object({
        debut: z.string().datetime({ offset: true }),
        fin: z.string().datetime({ offset: true }),
      })
      .refine((d) => Date.parse(d.debut) <= Date.parse(d.fin), "dates: début après fin")
      .optional(),
    villes: z.array(z.string().trim().min(1).max(80)).min(1).max(50).optional(),
    abTest: z.boolean().optional(),
  })
  .refine(
    (c) => Object.keys(c).length > 0,
    "Une règle doit avoir au moins une condition",
  )
  .refine(
    (c) => Boolean(c.heureMin) === Boolean(c.heureMax),
    "heureMin et heureMax vont ensemble",
  )
  .refine(
    (c) =>
      c.minScansTotal === undefined ||
      c.maxScansTotal === undefined ||
      c.minScansTotal < c.maxScansTotal,
    "minScansTotal doit être inférieur à maxScansTotal",
  )
  .refine(
    (c) =>
      c.minScansAppareil === undefined ||
      c.maxScansAppareil === undefined ||
      c.minScansAppareil < c.maxScansAppareil,
    "minScansAppareil doit être inférieur à maxScansAppareil",
  );

const varianteIdSchema = z.union([
  z.string(),
  z.array(z.string()).min(2).max(5),
]);

export const routingConfigSchema = z
  .object({
    version: z.literal(1),
    actif: z.boolean(),
    fuseau: z.string().trim().min(1).max(64),
    defaut: z.string(),
    variantes: z.array(varianteSchema).min(1).max(20),
    regles: z
      .array(
        z.object({
          id: z.string().min(4).max(16),
          priorite: z.number().int().min(1).max(9999),
          varianteId: varianteIdSchema,
          conditions: conditionsSchema,
        }),
      )
      .max(50),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    for (const variante of cfg.variantes) {
      if (ids.has(variante.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variantes"],
          message: `Identifiant de variante dupliqué : ${variante.id}`,
        });
      }
      ids.add(variante.id);
    }

    if (!ids.has(cfg.defaut)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaut"],
        message: "La variante par défaut est introuvable",
      });
    }

    const regleIds = new Set<string>();
    const priorities = new Set<number>();
    for (const regle of cfg.regles) {
      if (regleIds.has(regle.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["regles"],
          message: `Identifiant de règle dupliqué : ${regle.id}`,
        });
      }
      regleIds.add(regle.id);

      const varianteIds = Array.isArray(regle.varianteId)
        ? regle.varianteId
        : [regle.varianteId];

      for (const varianteId of varianteIds) {
        if (!ids.has(varianteId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["regles"],
            message: `Règle ${regle.id} → variante inconnue ${varianteId}`,
          });
        }
      }

      // A/B : tableau de variantes ET marqueur `abTest` vont ensemble.
      const estAbTest = Array.isArray(regle.varianteId);
      if (estAbTest !== Boolean(regle.conditions.abTest)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["regles"],
          message: `Règle ${regle.id} : le mode A/B exige un tableau de variantes et conditions.abTest = true`,
        });
      }

      if (estAbTest && new Set(varianteIds).size !== varianteIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["regles"],
          message: `Règle ${regle.id} : variantes A/B dupliquées`,
        });
      }

      if (priorities.has(regle.priorite)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["regles"],
          message: `Priorité dupliquée (${regle.priorite}) : l'ordre d'évaluation serait ambigu`,
        });
      }
      priorities.add(regle.priorite);
    }

    // Un routage "actif" avec une seule destination ne route rien : c'est une
    // erreur de configuration, pas un cas limite.
    if (cfg.actif && cfg.variantes.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variantes"],
        message: "Un routage actif nécessite au moins deux variantes",
      });
    }
  });

export const routingSimulationSchema = z.object({
  /** Configuration non enregistrée : permet l'aperçu live dans l'éditeur. */
  config: routingConfigSchema.optional(),
  pays: z.string().regex(/^[A-Z]{2}$/).optional(),
  langue: z.string().regex(/^[a-z]{2}$/).optional(),
  ville: z.string().trim().min(1).max(80).optional(),
  appareil: z.enum(["mobile", "tablet", "desktop"]).optional(),
  scansAppareil: z.number().int().min(1).max(1_000_000).optional(),
  date: z.string().datetime({ offset: true }).optional(),
  graine: z.string().max(200).optional(),
});

export type RoutingConfigInput = z.infer<typeof routingConfigSchema>;
export type RoutingSimulationSchemaInput = z.infer<typeof routingSimulationSchema>;
