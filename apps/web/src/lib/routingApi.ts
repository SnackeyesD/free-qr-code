import type {
  RoutingConfig,
  RoutingSimulationInput,
  RoutingSimulationResult,
  RoutingState,
  RoutingStatsResult,
} from '@free-qr/shared-types';
import axios from 'axios';
import { api } from '@/lib/api';

export interface RoutingSimulationPayload extends RoutingSimulationInput {
  config?: RoutingConfig;
}

export interface RoutingStatsQuery {
  from?: string;
  to?: string;
}

export const routingApi = {
  get: async (qrId: string): Promise<RoutingState> => {
    const { data } = await api.get<RoutingState>(`/qrcodes/${qrId}/routage`);
    return data;
  },

  save: async (qrId: string, config: RoutingConfig): Promise<RoutingState> => {
    const { data } = await api.put<RoutingState>(`/qrcodes/${qrId}/routage`, config);
    return data;
  },

  remove: async (qrId: string): Promise<RoutingState> => {
    const { data } = await api.delete<RoutingState>(`/qrcodes/${qrId}/routage`);
    return data;
  },

  simulate: async (
    qrId: string,
    payload: RoutingSimulationPayload,
  ): Promise<RoutingSimulationResult> => {
    const { data } = await api.post<RoutingSimulationResult>(
      `/qrcodes/${qrId}/routage/simuler`,
      payload,
    );
    return data;
  },

  stats: async (qrId: string, query: RoutingStatsQuery = {}): Promise<RoutingStatsResult> => {
    const { data } = await api.get<RoutingStatsResult>(`/qrcodes/${qrId}/routage/stats`, {
      params: query,
    });
    return data;
  },

  /** Télécharge le CSV via axios (l'API exige le JWT, un simple <a href> ne suffit pas). */
  downloadStatsCsv: async (qrId: string, query: RoutingStatsQuery = {}): Promise<void> => {
    const { data } = await api.get<Blob>(`/qrcodes/${qrId}/routage/stats.csv`, {
      params: query,
      responseType: 'blob',
    });

    const url = URL.createObjectURL(data);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `routage-${qrId}.csv`;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    URL.revokeObjectURL(url);
  },
};

/** Message lisible à partir du format d'erreur de l'API ou de Zod. */
export function routingErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | {
          error?: { message?: string } | string;
          success?: boolean;
          errorDetails?: unknown;
        }
      | undefined;

    if (data && typeof data.error === 'string') return data.error;
    if (data?.error && typeof data.error === 'object' && data.error.message) {
      return data.error.message;
    }
    if (data && data.success === false) {
      return 'Configuration invalide : vérifie les destinations et les règles.';
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Erreur inattendue';
}
