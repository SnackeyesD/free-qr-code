import { useState, useEffect, useCallback } from 'react';
import type { QRCode } from '@free-qr/shared-types';
import { qrApi, type QRListFilters } from '@/lib/qrApi';

interface UseQRListReturn {
  qrcodes: QRCode[];
  total: number;
  page: number;
  setPage: (page: number) => void;
  limit: number;
  setLimit: (limit: number) => void;
  search: string;
  setSearch: (search: string) => void;
  type: 'tous' | 'statique' | 'dynamique';
  setType: (type: 'tous' | 'statique' | 'dynamique') => void;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useQRList(defaultLimit = 10): UseQRListReturn {
  const [qrcodes, setQrcodes] = useState<QRCode[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'tous' | 'statique' | 'dynamique'>('tous');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: QRListFilters = {
        page,
        limit,
        search: search || undefined,
        type: type === 'tous' ? undefined : type,
      };
      const result = await qrApi.list(filters);
      setQrcodes(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des QR codes');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, type]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    qrcodes,
    total,
    page,
    setPage,
    limit,
    setLimit,
    search,
    setSearch,
    type,
    setType,
    isLoading,
    error,
    refetch,
  };
}
