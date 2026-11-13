import { useCallback, useEffect, useState } from 'react';
import type { Fiche } from '@free-qr/shared-types';
import { ficheApi, ficheErrorMessage } from '@/lib/ficheApi';

interface UseFichesReturn {
  fiches: Fiche[];
  total: number;
  page: number;
  setPage: (page: number) => void;
  limit: number;
  setLimit: (limit: number) => void;
  search: string;
  setSearch: (search: string) => void;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFiches(defaultLimit = 12): UseFichesReturn {
  const [fiches, setFiches] = useState<Fiche[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await ficheApi.list({
        page,
        limit,
        search: search.trim() || undefined,
      });
      setFiches(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(ficheErrorMessage(err, 'Erreur lors du chargement des fiches'));
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    fiches,
    total,
    page,
    setPage,
    limit,
    setLimit,
    search,
    setSearch,
    isLoading,
    error,
    refetch,
  };
}

interface UseFicheReturn {
  fiche: Fiche | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFiche(id: string | undefined): UseFicheReturn {
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      setFiche(await ficheApi.getById(id));
    } catch (err) {
      setError(ficheErrorMessage(err, 'Fiche introuvable'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { fiche, isLoading, error, refetch };
}
