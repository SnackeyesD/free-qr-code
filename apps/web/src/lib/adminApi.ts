import type {
  CampagneEmail,
  CampagneEmailInput,
  CampagneEnvoiInput,
  ModeleQR,
  ModeleQRInput,
  PaginatedResult,
  Utilisateur,
} from '@free-qr/shared-types';
import { api } from '@/lib/api';

export interface CampaignListFilters {
  page?: number;
  limit?: number;
  statut?: string;
  search?: string;
}

export interface TemplateListFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export interface UserListFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

export interface UpdateUserInput {
  estActif?: boolean;
  role?: 'utilisateur' | 'admin';
}

export const adminApi = {
  campaigns: {
    list: async (filters: CampaignListFilters = {}): Promise<PaginatedResult<CampagneEmail>> => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.statut) params.set('statut', filters.statut);
      if (filters.search) params.set('search', filters.search);
      const query = params.toString() ? `?${params.toString()}` : '';
      const { data } = await api.get<PaginatedResult<CampagneEmail>>(`/admin/campaigns${query}`);
      return data;
    },

    create: async (input: CampagneEmailInput): Promise<CampagneEmail> => {
      const { data } = await api.post<CampagneEmail>('/admin/campaigns', input);
      return data;
    },

    getById: async (id: string): Promise<CampagneEmail> => {
      const { data } = await api.get<CampagneEmail>(`/admin/campaigns/${id}`);
      return data;
    },

    update: async (id: string, input: Partial<CampagneEmailInput>): Promise<CampagneEmail> => {
      const { data } = await api.patch<CampagneEmail>(`/admin/campaigns/${id}`, input);
      return data;
    },

    remove: async (id: string): Promise<void> => {
      await api.delete(`/admin/campaigns/${id}`);
    },

    send: async (id: string, input?: CampagneEnvoiInput): Promise<void> => {
      await api.post(`/admin/campaigns/${id}/send`, input ?? {});
    },

    cancel: async (id: string): Promise<void> => {
      await api.post(`/admin/campaigns/${id}/cancel`);
    },
  },

  templates: {
    list: async (filters: TemplateListFilters = {}): Promise<PaginatedResult<ModeleQR>> => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search) params.set('search', filters.search);
      const query = params.toString() ? `?${params.toString()}` : '';
      const { data } = await api.get<PaginatedResult<ModeleQR>>(`/admin/templates${query}`);
      return data;
    },

    create: async (input: ModeleQRInput): Promise<ModeleQR> => {
      const { data } = await api.post<ModeleQR>('/admin/templates', input);
      return data;
    },

    getById: async (id: string): Promise<ModeleQR> => {
      const { data } = await api.get<ModeleQR>(`/admin/templates/${id}`);
      return data;
    },

    update: async (id: string, input: Partial<ModeleQRInput>): Promise<ModeleQR> => {
      const { data } = await api.patch<ModeleQR>(`/admin/templates/${id}`, input);
      return data;
    },

    remove: async (id: string): Promise<void> => {
      await api.delete(`/admin/templates/${id}`);
    },
  },

  users: {
    list: async (filters: UserListFilters = {}): Promise<PaginatedResult<Utilisateur>> => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search) params.set('search', filters.search);
      if (filters.role) params.set('role', filters.role);
      const query = params.toString() ? `?${params.toString()}` : '';
      const { data } = await api.get<PaginatedResult<Utilisateur>>(`/admin/users${query}`);
      return data;
    },

    update: async (id: string, input: UpdateUserInput): Promise<Utilisateur> => {
      const { data } = await api.patch<Utilisateur>(`/admin/users/${id}`, input);
      return data;
    },

    remove: async (id: string): Promise<void> => {
      await api.delete(`/admin/users/${id}`);
    },
  },
};
