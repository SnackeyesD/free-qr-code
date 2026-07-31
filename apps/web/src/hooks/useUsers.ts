import { useCallback, useEffect, useState } from 'react';
import type { Utilisateur } from '@free-qr/shared-types';
import { adminApi } from '@/lib/adminApi';

export interface UseUsersFilters {
  page: number;
  limit: number;
  search: string;
  role: '' | 'utilisateur' | 'admin';
}

interface UseUsersReturn {
  users: Utilisateur[];
  total: number;
  isLoading: boolean;
  error: string | null;
  filters: UseUsersFilters;
  setFilters: (filters: Partial<UseUsersFilters>) => void;
  refetch: () => Promise<void>;
  toggleActive: (id: string, estActif: boolean) => Promise<void>;
  changeRole: (id: string, role: 'utilisateur' | 'admin') => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<Utilisateur[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<UseUsersFilters>({
    page: 1,
    limit: 12,
    search: '',
    role: '',
  });

  const setFilters = useCallback((updates: Partial<UseUsersFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...updates, page: updates.page ?? (Object.keys(updates).some((k) => k !== 'page') ? 1 : prev.page) }));
  }, []);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.users.list({
        page: filters.page,
        limit: filters.limit,
        search: filters.search || undefined,
        role: filters.role || undefined,
      });
      setUsers(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des utilisateurs');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const toggleActive = useCallback(async (id: string, estActif: boolean) => {
    await adminApi.users.update(id, { estActif });
    await refetch();
  }, [refetch]);

  const changeRole = useCallback(async (id: string, role: 'utilisateur' | 'admin') => {
    await adminApi.users.update(id, { role });
    await refetch();
  }, [refetch]);

  const deleteUser = useCallback(async (id: string) => {
    await adminApi.users.remove(id);
    await refetch();
  }, [refetch]);

  return {
    users,
    total,
    isLoading,
    error,
    filters,
    setFilters,
    refetch,
    toggleActive,
    changeRole,
    deleteUser,
  };
}
