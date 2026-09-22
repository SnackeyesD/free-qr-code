import { z } from 'zod';
import type { QRCodeDesign } from '@free-qr/shared-types';

const typeContenuValues = [
  'url',
  'texte',
  'email',
  'telephone',
  'sms',
  'wifi',
  'vcard',
  'geo',
  'pdf',
] as const;

const designSchema: z.ZodType<QRCodeDesign> = z.object({
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().optional(),
  taille: z.number().int().min(64).max(2048).optional(),
  correction: z.enum(['L', 'M', 'Q', 'H']).optional(),
  cadre: z.boolean().optional(),
  formatImage: z.enum(['png', 'svg']).optional(),
  idModele: z.string().optional(),
}).catchall(z.unknown());

export const createQRCodeSchema = z.object({
  type: z.enum(['statique', 'dynamique']),
  contenu: z.string().min(1).max(4096),
  typeContenu: z.enum(typeContenuValues).optional(),
  parametres: designSchema.optional(),
});

export const updateQRCodeSchema = z.object({
  contenu: z.string().min(1).max(4096).optional(),
  estActif: z.boolean().optional(),
  parametres: designSchema.optional(),
});

export const listQRCodesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['statique', 'dynamique']).optional(),
  search: z.string().max(200).optional(),
});

export const downloadQRCodeSchema = z.object({
  format: z.enum(['png', 'svg']).default('png'),
});

export type CreateQRCodeInput = z.infer<typeof createQRCodeSchema>;
export type UpdateQRCodeInput = z.infer<typeof updateQRCodeSchema>;
export type ListQRCodeInput = z.infer<typeof listQRCodesSchema>;
export type DownloadQRCodeInput = z.infer<typeof downloadQRCodeSchema>;
