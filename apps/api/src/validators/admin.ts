import { z } from 'zod';
import type { TypeContenuQR } from '@free-qr/shared-types';
import { QRCodeDesign } from '@free-qr/shared-types';

export const cibleCampagneValues = [
  'tous',
  'actifs',
  'inactifs',
  'non_verifies',
  'consentants',
] as const;

export type CibleCampagneEmail = (typeof cibleCampagneValues)[number];

export const createCampaignSchema = z.object({
  nom: z.string().min(1).max(200),
  sujet: z.string().min(1).max(200),
  corpsHtml: z.string().min(1).max(50000),
  corpsTexte: z.string().max(50000).optional(),
  cible: z.enum(cibleCampagneValues).optional(),
});

export const updateCampaignSchema = z.object({
  nom: z.string().min(1).max(200).optional(),
  sujet: z.string().min(1).max(200).optional(),
  corpsHtml: z.string().min(1).max(50000).optional(),
  corpsTexte: z.string().max(50000).optional(),
  cible: z.enum(cibleCampagneValues).optional(),
});

export const sendCampaignSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
});

const typeContenuValues: readonly TypeContenuQR[] = [
  'url',
  'texte',
  'email',
  'telephone',
  'sms',
  'wifi',
  'vcard',
  'geo',
  'pdf',
];

const designSchema: z.ZodType<QRCodeDesign> = z.object({
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().optional(),
  taille: z.number().int().min(64).max(2048).optional(),
  correction: z.enum(['L', 'M', 'Q', 'H']).optional(),
  cadre: z.boolean().optional(),
  formatImage: z.enum(['png', 'svg']).optional(),
}).catchall(z.unknown());

export const createTemplateSchema = z.object({
  nom: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  typeContenu: z.enum(typeContenuValues as [TypeContenuQR, ...TypeContenuQR[]]).optional(),
  parametresParDefaut: designSchema.optional(),
  estPublic: z.boolean().optional(),
});

export const updateTemplateSchema = z.object({
  nom: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  typeContenu: z.enum(typeContenuValues as [TypeContenuQR, ...TypeContenuQR[]]).optional(),
  parametresParDefaut: designSchema.optional(),
  estPublic: z.boolean().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type SendCampaignInput = z.infer<typeof sendCampaignSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
