import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Utilisateur as User } from '@free-qr/shared-types';
import { useAuth } from '@/contexts/AuthContext';
import { getMe, updateProfile, type MeUpdateInput } from '@/lib/userApi';

type LoadingState = 'idle' | 'loading' | 'saving';

interface UseSettingsReturn {
  user: User | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  success: string | null;
  refresh: () => Promise<void>;
  update: (data: MeUpdateInput) => Promise<void>;
  clearMessages: () => void;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    if ('response' in err && err.response && typeof err.response === 'object') {
      const response = err.response as { data?: { message?: string } };
      if (response.data?.message) return response.data.message;
    }
    if ('message' in err && typeof err.message === 'string') {
      return err.message;
    }
  }
  return fallback;
}

export function useSettings(): UseSettingsReturn {
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;
  const [user, setUser] = useState<User | null>(auth.user);
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState('loading');
    setError(null);
    setSuccess(null);
    try {
      const profile = await getMe();
      setUser(profile);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossible de charger le profil.'));
    } finally {
      setState((current) => (current === 'loading' ? 'idle' : current));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(async (data: MeUpdateInput) => {
    setState('saving');
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateProfile(data);
      setUser(updated);
      setSuccess('Vos paramètres ont été enregistrés.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossible de mettre à jour le profil.'));
    } finally {
      setState((current) => (current === 'saving' ? 'idle' : current));
    }
  }, []);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return useMemo(
    () => ({
      user,
      isLoading: state === 'loading',
      isSaving: state === 'saving',
      error,
      success,
      refresh,
      update,
      clearMessages,
    }),
    [user, state, error, success, refresh, update, clearMessages],
  );
}
