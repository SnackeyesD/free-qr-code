import { useState, useEffect, useCallback } from 'react';
import type { StatistiquesQRCode, StatistiquesJournalieres } from '@free-qr/shared-types';
import { qrApi, type QRStatsRange } from '@/lib/qrApi';

export const PERIOD_DAYS: Record<string, number> = {
  '24h': 1,
  '7j': 7,
  '30j': 30,
  '90j': 90,
  '1an': 365,
};

export function rangeForPeriod(period: string, now = new Date()): QRStatsRange {
  const days = PERIOD_DAYS[period] ?? 7;
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from, to };
}

interface UseQRStatsReturn {
  stats: StatistiquesQRCode | null;
  dailyStats: StatistiquesJournalieres[];
  isLoading: boolean;
  error: string | null;
  period: string;
  setPeriod: (period: string) => void;
  refetch: () => Promise<void>;
}

export function useQRStats(id: string | undefined): UseQRStatsReturn {
  const [stats, setStats] = useState<StatistiquesQRCode | null>(null);
  const [dailyStats, setDailyStats] = useState<StatistiquesJournalieres[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7j');

  const refetch = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      // Un seul appel : l'API retourne totaux + evolution journalière + répartitions.
      const statsData = await qrApi.stats(id, rangeForPeriod(period));
      setStats(statsData);
      setDailyStats(
        (statsData.evolution ?? []).map((point) => ({
          id: `${id}-${point.date}`,
          idQRCode: id,
          date: point.date,
          nombreScans: point.scans,
          nombreScansUniques: point.scansUniques,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des statistiques');
    } finally {
      setIsLoading(false);
    }
  }, [id, period]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    stats,
    dailyStats,
    isLoading,
    error,
    period,
    setPeriod,
    refetch,
  };
}
