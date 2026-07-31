import { useCallback, useEffect, useState } from 'react';
import type { ModeleQR, QRCodeDesign, TypeContenuQR } from '@free-qr/shared-types';
import { adminApi } from '@/lib/adminApi';

export interface UseTemplatesFilters {
  page: number;
  limit: number;
  search: string;
}

interface UseTemplatesReturn {
  templates: ModeleQR[];
  total: number;
  isLoading: boolean;
  error: string | null;
  filters: UseTemplatesFilters;
  setFilters: (filters: Partial<UseTemplatesFilters>) => void;
  refetch: () => Promise<void>;
  createTemplate: (input: {
    nom: string;
    type: 'statique' | 'dynamique';
    contenu: string;
    estPublic: boolean;
    categorie?: string;
    typeContenu?: TypeContenuQR;
    parametresParDefaut?: QRCodeDesign;
  }) => Promise<ModeleQR>;
  deleteTemplate: (id: string) => Promise<void>;
}

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<ModeleQR[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<UseTemplatesFilters>({
    page: 1,
    limit: 12,
    search: '',
  });

  const setFilters = useCallback((updates: Partial<UseTemplatesFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...updates, page: updates.page ?? (Object.keys(updates).some((k) => k !== 'page') ? 1 : prev.page) }));
  }, []);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.templates.list({
        page: filters.page,
        limit: filters.limit,
        search: filters.search || undefined,
      });
      setTemplates(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des modèles');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createTemplate = useCallback(async (input: {
    nom: string;
    type: 'statique' | 'dynamique';
    contenu: string;
    estPublic: boolean;
    categorie?: string;
    typeContenu?: TypeContenuQR;
    parametresParDefaut?: QRCodeDesign;
  }) => {
    const template = await adminApi.templates.create({
      ...input,
      typeContenu: input.typeContenu ?? 'url',
      parametresParDefaut: input.parametresParDefaut ?? {},
    });
    await refetch();
    return template;
  }, [refetch]);

  const deleteTemplate = useCallback(async (id: string) => {
    await adminApi.templates.remove(id);
    await refetch();
  }, [refetch]);

  return {
    templates,
    total,
    isLoading,
    error,
    filters,
    setFilters,
    refetch,
    createTemplate,
    deleteTemplate,
  };
}

interface UseTemplateReturn {
  template: ModeleQR | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateTemplate: (input: Partial<{
    nom: string;
    type: 'statique' | 'dynamique';
    contenu: string;
    estPublic: boolean;
    categorie?: string;
    typeContenu?: TypeContenuQR;
    parametresParDefaut?: QRCodeDesign;
  }>) => Promise<ModeleQR>;
}

export function useTemplate(id: string | undefined): UseTemplateReturn {
  const [template, setTemplate] = useState<ModeleQR | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.templates.getById(id);
      setTemplate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement du modèle');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const updateTemplate = useCallback(async (input: Partial<{
    nom: string;
    type: 'statique' | 'dynamique';
    contenu: string;
    estPublic: boolean;
    categorie?: string;
    typeContenu?: TypeContenuQR;
    parametresParDefaut?: QRCodeDesign;
  }>) => {
    if (!id) throw new Error('ID de modèle manquant');
    const updated = await adminApi.templates.update(id, input);
    setTemplate(updated);
    return updated;
  }, [id]);

  return {
    template,
    isLoading,
    error,
    refetch,
    updateTemplate,
  };
}
