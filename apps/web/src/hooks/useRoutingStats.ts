import { useCallback, useEffect, useState } from 'react';
import type { RoutingStatsResult } from '@free-qr/shared-types';
import { routingApi, routingErrorMessage } from '@/lib/routingApi';

export type PeriodeRoutage = '24h' | '7j' | '30j' | '90j' | '1an';

const JOURS_PAR_PERIODE: Record<PeriodeRoutage, number> = {
  '24h': 1,
  '7j': 7,
  '30j': 30,
  '90j': 90,
  '1an': 365,
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function periodeVersDates(periode: PeriodeRoutage, maintenant = new Date()): {
  from: string;
  to: string;
} {
  const debut = new Date(maintenant.getTime() - JOURS_PAR_PERIODE[periode] * 24 * 3600 * 1000);
  return { from: isoDate(debut), to: isoDate(maintenant) };
}

interface UseRoutingStatsReturn {
  stats: RoutingStatsResult | null;
  isLoading: boolean;
  error: string | null;
  periode: PeriodeRoutage;
  setPeriode: (periode: PeriodeRoutage) => void;
  refetch: () => Promise<void>;
  telechargerCsv: () => Promise<void>;
}

export function useRoutingStats(qrId: string | undefined): UseRoutingStatsReturn {
  const [stats, setStats] = useState<RoutingStatsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periode, setPeriode] = useState<PeriodeRoutage>('7j');

  const requete = useCallback(() => {
    return periodeVersDates(periode);
  }, [periode]);

  const refetch = useCallback(async () => {
    if (!qrId) return;
    setIsLoading(true);
    setError(null);
    try {
      setStats(await routingApi.stats(qrId, requete()));
    } catch (err) {
      setError(routingErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [qrId, requete]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const telechargerCsv = useCallback(async () => {
    if (!qrId) return;
    setError(null);
    try {
      await routingApi.downloadStatsCsv(qrId, requete());
    } catch (err) {
      setError(routingErrorMessage(err));
    }
  }, [qrId, requete]);

  return { stats, isLoading, error, periode, setPeriode, refetch, telechargerCsv };
}
