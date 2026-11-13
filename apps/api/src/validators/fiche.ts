import { z } from "zod";
import type { SchemaFiche, ValeursFiche } from "@free-qr/shared-types";

const CLE_REGEX = /^[a-z][a-z0-9_]{0,31}$/;

export const typeChampFicheValues = [
  "texte",
  "texte_long",
  "email",
  "telephone",
  "url",
  "date",
  "nombre",
  "liste",
  "booleen",
  "section",
] as const;

export const optionChampFicheSchema = z.object({
  valeur: z.string().min(1).max(80),
  libelle: z.string().min(1).max(80),
});

export const champFicheSchema = z
  .object({
    cle: z
      .string()
      .regex(
        CLE_REGEX,
        "La clé doit commencer par une lettre et ne contenir que a-z, 0-9 et _",
      ),
    libelle: z.string().min(1).max(80),
    type: z.enum(typeChampFicheValues),
    obligatoire: z.boolean().optional(),
    aide: z.string().max(200).optional(),
    placeholder: z.string().max(100).optional(),
    options: z.array(optionChampFicheSchema).max(50).optional(),
  })
  .superRefine((champ, ctx) => {
    if (champ.type === "liste") {
      if (!champ.options || champ.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Un champ liste doit proposer au moins une option",
        });
      } else if (
        new Set(champ.options.map((option) => option.valeur)).size !==
        champ.options.length
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Les valeurs des options doivent être uniques",
        });
      }
    }
    if (champ.type === "section" && champ.obligatoire) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["obligatoire"],
        message: "Une section ne peut pas être obligatoire",
      });
    }
  });

export const schemaFicheSchema: z.ZodType<SchemaFiche> = z
  .object({
    version: z.literal(1),
    champs: z.array(champFicheSchema).min(1).max(30),
  })
  .superRefine((schema, ctx) => {
    const cles = schema.champs.map((champ) => champ.cle);
    if (new Set(cles).size !== cles.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["champs"],
        message: "Les clés des champs doivent être uniques",
      });
    }
  }) as unknown as z.ZodType<SchemaFiche>;

const valeurFicheSchema = z.union([
  z.string().max(10000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const valeursFicheSchema: z.ZodType<ValeursFiche> = z.record(
  valeurFicheSchema,
) as unknown as z.ZodType<ValeursFiche>;

export const createFicheModeleSchema = z.object({
  nom: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  schema: schemaFicheSchema,
  estPublic: z.boolean().optional(),
});

export const updateFicheModeleSchema = z
  .object({
    nom: z.string().min(1).max(120).optional(),
    description: z.string().max(1000).optional(),
    schema: schemaFicheSchema.optional(),
    estPublic: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Aucune modification fournie",
  });

export const createFicheSchema = z
  .object({
    titre: z.string().min(1).max(120),
    idModele: z.string().uuid().optional(),
    schema: schemaFicheSchema.optional(),
    valeurs: valeursFicheSchema,
  })
  .refine((data) => Boolean(data.idModele) || Boolean(data.schema), {
    message: "Un modèle ou un schéma est requis",
    path: ["schema"],
  });

export const updateFicheSchema = z
  .object({
    titre: z.string().min(1).max(120).optional(),
    schema: schemaFicheSchema.optional(),
    valeurs: valeursFicheSchema.optional(),
    estActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Aucune modification fournie",
  });

export const listFichesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
});

export type CreateFicheModeleInput = z.infer<typeof createFicheModeleSchema>;
export type UpdateFicheModeleInput = z.infer<typeof updateFicheModeleSchema>;
export type CreateFicheInput = z.infer<typeof createFicheSchema>;
export type UpdateFicheInput = z.infer<typeof updateFicheSchema>;
export type ListFichesInput = z.infer<typeof listFichesSchema>;
