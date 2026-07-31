import { useState, useEffect, useCallback } from 'react';
import type { StatistiquesQRCode, StatistiquesJournalieres, Scan } from '@free-qr/shared-types';
import { qrApi } from '@/lib/qrApi';

interface UseQRStatsReturn {
  stats: StatistiquesQRCode | null;
  dailyStats: StatistiquesJournalieres[];
  recentScans: Scan[];
  isLoading: boolean;
  error: string | null;
  period: string;
  setPeriod: (period: string) => void;
  refetch: () => Promise<void>;
}

export function useQRStats(id: string | undefined): UseQRStatsReturn {
  const [stats, setStats] = useState<StatistiquesQRCode | null>(null);
  const [dailyStats, setDailyStats] = useState<StatistiquesJournalieres[]>([]);
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7j');

  const refetch = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, dailyData, scansData] = await Promise.all([
        qrApi.stats(id, period),
        qrApi.dailyStats(id),
        qrApi.recentScans(id, 50),
      ]);
      setStats(statsData);
      setDailyStats(dailyData);
      setRecentScans(scansData);
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
    recentScans,
    isLoading,
    error,
    period,
    setPeriod,
    refetch,
  };
}
