import { useCallback, useEffect, useState } from 'react';
import type { ModeleQR } from '@free-qr/shared-types';
import { templatesApi } from '@/lib/templatesApi';

interface UsePublicTemplatesReturn {
  templates: ModeleQR[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePublicTemplates(): UsePublicTemplatesReturn {
  const [templates, setTemplates] = useState<ModeleQR[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await templatesApi.publics.list();
      setTemplates(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors du chargement des modèles publics',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { templates, total, isLoading, error, refetch };
}

interface UsePublicTemplateReturn {
  template: ModeleQR | null;
  isLoading: boolean;
  error: string | null;
}

export function usePublicTemplate(publicId: string | undefined): UsePublicTemplateReturn {
  const [template, setTemplate] = useState<ModeleQR | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(publicId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicId) {
      setTemplate(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setTemplate(null);

    void templatesApi.publics
      .getById(publicId)
      .then((data) => {
        if (!cancelled) setTemplate(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Ce modèle public est introuvable.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicId]);

  return { template, isLoading, error };
}
