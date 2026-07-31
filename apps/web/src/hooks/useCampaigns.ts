import { useCallback, useEffect, useState } from 'react';
import type { CampagneEmail, CibleCampagneEmail, StatutCampagneEmail } from '@free-qr/shared-types';
import { adminApi } from '@/lib/adminApi';

export interface UseCampaignsFilters {
  page: number;
  limit: number;
  statut: '' | StatutCampagneEmail;
  search: string;
}

interface UseCampaignsReturn {
  campaigns: CampagneEmail[];
  total: number;
  isLoading: boolean;
  error: string | null;
  filters: UseCampaignsFilters;
  setFilters: (filters: Partial<UseCampaignsFilters>) => void;
  refetch: () => Promise<void>;
  createCampaign: (input: {
    nom: string;
    sujet: string;
    corpsHtml: string;
    corpsTexte?: string;
    cible?: CibleCampagneEmail;
  }) => Promise<CampagneEmail>;
  deleteCampaign: (id: string) => Promise<void>;
  sendCampaign: (id: string, scheduledAt?: Date | string) => Promise<void>;
  cancelCampaign: (id: string) => Promise<void>;
}

export function useCampaigns(): UseCampaignsReturn {
  const [campaigns, setCampaigns] = useState<CampagneEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<UseCampaignsFilters>({
    page: 1,
    limit: 12,
    statut: '',
    search: '',
  });

  const setFilters = useCallback((updates: Partial<UseCampaignsFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...updates, page: updates.page ?? (Object.keys(updates).some((k) => k !== 'page') ? 1 : prev.page) }));
  }, []);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.campaigns.list({
        page: filters.page,
        limit: filters.limit,
        statut: filters.statut || undefined,
        search: filters.search || undefined,
      });
      setCampaigns(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des campagnes');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createCampaign = useCallback(async (input: {
    nom: string;
    sujet: string;
    corpsHtml: string;
    corpsTexte?: string;
    cible?: CibleCampagneEmail;
  }) => {
    const campaign = await adminApi.campaigns.create({
      ...input,
      cible: input.cible ?? 'tous',
    });
    await refetch();
    return campaign;
  }, [refetch]);

  const deleteCampaign = useCallback(async (id: string) => {
    await adminApi.campaigns.remove(id);
    await refetch();
  }, [refetch]);

  const sendCampaign = useCallback(async (id: string, scheduledAt?: Date | string) => {
    await adminApi.campaigns.send(id, scheduledAt ? { scheduledAt } : undefined);
    await refetch();
  }, [refetch]);

  const cancelCampaign = useCallback(async (id: string) => {
    await adminApi.campaigns.cancel(id);
    await refetch();
  }, [refetch]);

  return {
    campaigns,
    total,
    isLoading,
    error,
    filters,
    setFilters,
    refetch,
    createCampaign,
    deleteCampaign,
    sendCampaign,
    cancelCampaign,
  };
}

interface UseCampaignReturn {
  campaign: CampagneEmail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateCampaign: (input: Partial<{
    nom: string;
    sujet: string;
    corpsHtml: string;
    corpsTexte?: string;
    cible?: CibleCampagneEmail;
  }>) => Promise<CampagneEmail>;
  sendCampaign: (scheduledAt?: Date | string) => Promise<void>;
  cancelCampaign: () => Promise<void>;
}

export function useCampaign(id: string | undefined): UseCampaignReturn {
  const [campaign, setCampaign] = useState<CampagneEmail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.campaigns.getById(id);
      setCampaign(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement de la campagne');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const updateCampaign = useCallback(async (input: Partial<{
    nom: string;
    sujet: string;
    corpsHtml: string;
    corpsTexte?: string;
    cible?: CibleCampagneEmail;
  }>) => {
    if (!id) throw new Error('ID de campagne manquant');
    const updated = await adminApi.campaigns.update(id, input);
    setCampaign(updated);
    return updated;
  }, [id]);

  const sendCampaign = useCallback(async (scheduledAt?: Date | string) => {
    if (!id) throw new Error('ID de campagne manquant');
    await adminApi.campaigns.send(id, scheduledAt ? { scheduledAt } : undefined);
    await refetch();
  }, [id, refetch]);

  const cancelCampaign = useCallback(async () => {
    if (!id) throw new Error('ID de campagne manquant');
    await adminApi.campaigns.cancel(id);
    await refetch();
  }, [id, refetch]);

  return {
    campaign,
    isLoading,
    error,
    refetch,
    updateCampaign,
    sendCampaign,
    cancelCampaign,
  };
}
