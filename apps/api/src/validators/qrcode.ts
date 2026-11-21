import { z } from "zod";
import type { QRCodeDesign } from "@free-qr/shared-types";

const typeContenuValues = [
  "url",
  "texte",
  "email",
  "telephone",
  "sms",
  "wifi",
  "vcard",
  "geo",
  "pdf",
] as const;

const designSchema: z.ZodType<QRCodeDesign> = z
  .object({
    couleur: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    background: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    logoUrl: z.string().url().optional(),
    taille: z.number().int().min(64).max(2048).optional(),
    correction: z.enum(["L", "M", "Q", "H"]).optional(),
    cadre: z.boolean().optional(),
    formatImage: z.enum(["png", "svg", "pdf"]).optional(),
    idModele: z.string().optional(),
  })
  .catchall(z.unknown());

export const createQRCodeSchema = z
  .object({
    type: z.enum(["statique", "dynamique"]).optional(),
    contenu: z.string().max(4096).optional(),
    typeContenu: z.enum(typeContenuValues).optional(),
    /** Crée un QR dynamique pointant vers la page de rendu de la fiche. */
    idFiche: z.string().uuid().optional(),
    design: designSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.idFiche && data.contenu !== undefined && data.contenu.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contenu"],
        message: "Fournissez contenu ou idFiche, pas les deux",
      });
    }
    if (!data.idFiche && (!data.contenu || data.contenu.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contenu"],
        message: "Le contenu est requis",
      });
    }
  });

export const updateQRCodeSchema = z
  .object({
    contenu: z.string().min(1).max(4096).optional(),
    typeContenu: z.enum(typeContenuValues).optional(),
    /** Lie (ou délie avec `null`) une fiche au QR. */
    idFiche: z.string().uuid().nullable().optional(),
    estActif: z.boolean().optional(),
    parametres: designSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.idFiche !== undefined &&
      data.idFiche !== null &&
      data.contenu !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contenu"],
        message: "Fournissez contenu ou idFiche, pas les deux",
      });
    }
  });

export const listQRCodesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["statique", "dynamique"]).optional(),
  search: z.string().max(200).optional(),
});

export const downloadQRCodeSchema = z.object({
  format: z.enum(["png", "svg", "pdf"]).default("png"),
});

export const previewQrSchema = z.object({
  content: z.string().min(1).max(4096),
  couleur: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  background: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  size: z.coerce.number().int().min(64).max(600).default(400),
  correction: z.enum(["L", "M", "Q", "H"]).default("M"),
});

export type CreateQRCodeInput = z.infer<typeof createQRCodeSchema>;
export type UpdateQRCodeInput = z.infer<typeof updateQRCodeSchema>;
export type ListQRCodeInput = z.infer<typeof listQRCodesSchema>;
export type DownloadQRCodeInput = z.infer<typeof downloadQRCodeSchema>;
export type PreviewQrInput = z.infer<typeof previewQrSchema>;
