import type { Session } from '@free-qr/shared-types';
import { api } from '@/lib/api';

export interface UserSession extends Session {
  isCurrent: boolean;
}

export interface SessionListResponse {
  data: UserSession[];
}

export const sessionsApi = {
  list: async (): Promise<UserSession[]> => {
    const { data } = await api.get<SessionListResponse | UserSession[]>('/me/sessions');
    const sessions = Array.isArray(data) ? data : data.data;
    return sessions.map((s) => ({ ...s, isCurrent: false }));
  },

  revoke: async (id: string | number): Promise<void> => {
    await api.delete(`/me/sessions/${encodeURIComponent(String(id))}`);
  },

  revokeAllExceptCurrent: async (): Promise<void> => {
    await api.delete('/me/sessions');
  },
};
