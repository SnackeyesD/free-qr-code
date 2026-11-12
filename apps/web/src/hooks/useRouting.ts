import { useCallback, useEffect, useState } from 'react';
import type { RoutingConfig, RoutingState } from '@free-qr/shared-types';
import { routingApi, routingErrorMessage } from '@/lib/routingApi';

interface UseRoutingReturn {
  state: RoutingState | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  save: (config: RoutingConfig) => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useRouting(qrId: string | undefined): UseRoutingReturn {
  const [state, setState] = useState<RoutingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!qrId) return;
    setIsLoading(true);
    setError(null);
    try {
      setState(await routingApi.get(qrId));
    } catch (err) {
      setError(routingErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [qrId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const save = useCallback(
    async (config: RoutingConfig): Promise<boolean> => {
      if (!qrId) return false;
      setIsSaving(true);
      setError(null);
      try {
        setState(await routingApi.save(qrId, config));
        return true;
      } catch (err) {
        setError(routingErrorMessage(err));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [qrId],
  );

  const remove = useCallback(async (): Promise<boolean> => {
    if (!qrId) return false;
    setIsSaving(true);
    setError(null);
    try {
      setState(await routingApi.remove(qrId));
      return true;
    } catch (err) {
      setError(routingErrorMessage(err));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [qrId]);

  return { state, isLoading, isSaving, error, refetch, save, remove };
}
