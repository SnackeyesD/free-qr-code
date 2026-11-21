import { useCallback, useEffect, useState } from 'react';
import type { CleApi, CleApiCreee, CleApiInput } from '@free-qr/shared-types';
import { apiKeysApi } from '@/lib/apiKeysApi';

export interface UseApiKeysReturn {
  keys: CleApi[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createKey: (input: CleApiInput) => Promise<CleApiCreee>;
  revokeKey: (id: string) => Promise<void>;
}

export function useApiKeys(): UseApiKeysReturn {
  const [keys, setKeys] = useState<CleApi[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiKeysApi.list();
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des clés API');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createKey = useCallback(async (input: CleApiInput): Promise<CleApiCreee> => {
    const created = await apiKeysApi.create(input);
    await refetch();
    return created;
  }, [refetch]);

  const revokeKey = useCallback(async (id: string): Promise<void> => {
    await apiKeysApi.revoke(id);
    await refetch();
  }, [refetch]);

  return {
    keys,
    isLoading,
    error,
    refetch,
    createKey,
    revokeKey,
  };
}
