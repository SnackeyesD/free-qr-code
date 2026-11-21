import type { CleApi, CleApiCreee, CleApiInput } from '@free-qr/shared-types';
import { api } from '@/lib/api';

export interface ApiKeyListResponse {
  data: CleApi[];
}

export const apiKeysApi = {
  list: async (): Promise<CleApi[]> => {
    const { data } = await api.get<ApiKeyListResponse>('/api-keys');
    return data.data;
  },

  create: async (input: CleApiInput): Promise<CleApiCreee> => {
    const { data } = await api.post<CleApiCreee>('/api-keys', input);
    return data;
  },

  revoke: async (id: string): Promise<void> => {
    await api.delete(`/api-keys/${id}`);
  },
};
