import axios from 'axios';
import type {
  Fiche,
  FicheInput,
  FicheListQuery,
  FicheModele,
  FicheModeleInput,
  FicheModeleUpdateInput,
  FichePublique,
  FicheUpdateInput,
  PaginatedResult,
} from '@free-qr/shared-types';
import { api } from '@/lib/api';

export interface FicheListFilters extends FicheListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export const ficheApi = {
  list: async (filters: FicheListFilters = {}): Promise<PaginatedResult<Fiche>> => {
    const { data } = await api.get<PaginatedResult<Fiche>>('/fiches', {
      params: filters,
    });
    return data;
  },

  getById: async (id: string): Promise<Fiche> => {
    const { data } = await api.get<Fiche>(`/fiches/${id}`);
    return data;
  },

  create: async (input: FicheInput): Promise<Fiche> => {
    const { data } = await api.post<Fiche>('/fiches', input);
    return data;
  },

  update: async (id: string, input: FicheUpdateInput): Promise<Fiche> => {
    const { data } = await api.patch<Fiche>(`/fiches/${id}`, input);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/fiches/${id}`);
  },

  listModeles: async (): Promise<{ data: FicheModele[]; total: number }> => {
    const { data } = await api.get<{ data: FicheModele[]; total: number }>(
      '/fiches/modeles',
    );
    return data;
  },

  getModeleById: async (id: string): Promise<FicheModele> => {
    const { data } = await api.get<FicheModele>(`/fiches/modeles/${id}`);
    return data;
  },

  createModele: async (input: FicheModeleInput): Promise<FicheModele> => {
    const { data } = await api.post<FicheModele>('/fiches/modeles', input);
    return data;
  },

  updateModele: async (
    id: string,
    input: FicheModeleUpdateInput,
  ): Promise<FicheModele> => {
    const { data } = await api.patch<FicheModele>(`/fiches/modeles/${id}`, input);
    return data;
  },

  removeModele: async (id: string): Promise<void> => {
    await api.delete(`/fiches/modeles/${id}`);
  },

  getPublique: async (publicId: string): Promise<FichePublique> => {
    const { data } = await api.get<FichePublique>(
      `/public/fiches/${encodeURIComponent(publicId)}`,
    );
    return data;
  },
};

/** Message lisible à partir du format d'erreur de l'API. */
export function ficheErrorMessage(
  err: unknown,
  fallback = 'Une erreur est survenue',
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | {
          error?: { message?: string } | string;
          message?: string;
        }
      | undefined;

    if (typeof data?.error === 'string') return data.error;
    if (data?.error && typeof data.error === 'object' && data.error.message) {
      return data.error.message;
    }
    if (typeof data?.message === 'string') return data.message;
    return err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

/** Statut HTTP d'une erreur Axios, si disponible. */
export function ficheErrorStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}
