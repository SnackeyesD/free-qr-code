import { z } from 'zod';

export const updateMeSchema = z.object({
  nom: z
    .string()
    .max(100)
    .optional()
    .transform((v) => (v === undefined ? v : v.trim())),
  consentementMarketing: z.boolean().optional(),
  motDePasseActuel: z.string().optional(),
  nouveauMotDePasse: z.string().min(8).optional(),
}).refine((data) => {
  const hasCurrent = data.motDePasseActuel !== undefined;
  const hasNew = data.nouveauMotDePasse !== undefined;
  return hasCurrent === hasNew;
}, {
  message: 'motDePasseActuel et nouveauMotDePasse doivent être fournis ensemble',
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
