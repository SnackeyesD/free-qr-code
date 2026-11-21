import { useCallback, useEffect, useState } from 'react';
import { sessionsApi, type UserSession } from '@/lib/sessionsApi';

export interface UseSessionsReturn {
  sessions: UserSession[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  revokeSession: (id: string | number) => Promise<void>;
  revokeAllOthers: () => Promise<void>;
  isRevoking: boolean;
  isRevokingAll: boolean;
  isSuccess: boolean;
}

function determineCurrentSession(sessions: UserSession[]): UserSession[] {
  const index = sessions.findIndex((s) => s.isCurrent);

  if (index >= 0) return sessions;

  const available = sessions.filter((s) => !s.estRevoke);
  if (available.length === 0) return sessions;

  return sessions.map((s) =>
    s.tokenHash === available[0].tokenHash ? { ...s, isCurrent: true } : s,
  );
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);
    try {
      const data = await sessionsApi.list();
      setSessions(determineCurrentSession(data));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors du chargement des sessions',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const revokeSession = useCallback(
    async (id: string | number) => {
      setIsRevoking(true);
      setError(null);
      setIsSuccess(false);
      try {
        await sessionsApi.revoke(id);
        setIsSuccess(true);
        await fetchSessions();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Erreur lors de la révocation de la session',
        );
      } finally {
        setIsRevoking(false);
      }
    },
    [fetchSessions],
  );

  const revokeAllOthers = useCallback(async () => {
    setIsRevokingAll(true);
    setError(null);
    setIsSuccess(false);
    try {
      await sessionsApi.revokeAllExceptCurrent();
      setIsSuccess(true);
      await fetchSessions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la révocation des autres sessions",
      );
    } finally {
      setIsRevokingAll(false);
    }
  }, [fetchSessions]);

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchSessions,
    revokeSession,
    revokeAllOthers,
    isRevoking,
    isRevokingAll,
    isSuccess,
  };
}
