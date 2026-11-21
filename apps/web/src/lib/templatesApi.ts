import type { ModeleQR } from '@free-qr/shared-types';
import { api } from '@/lib/api';

export interface PublicTemplatesResult {
  data: ModeleQR[];
  total: number;
}

/** Galerie en lecture seule : accessible à tout utilisateur connecté. */
export const templatesApi = {
  publics: {
    list: async (): Promise<PublicTemplatesResult> => {
      const { data } = await api.get<PublicTemplatesResult>('/templates/publics');
      return data;
    },

    getById: async (publicId: string): Promise<ModeleQR> => {
      const { data } = await api.get<ModeleQR>(
        `/templates/publics/${encodeURIComponent(publicId)}`,
      );
      return data;
    },
  },
};
