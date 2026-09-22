import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Utilisateur as User, AuthLoginInput as LoginInput, AuthRegisterInput as UserInput } from '@free-qr/shared-types';
import { api } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: UserInput) => Promise<void>;
  logout: () => Promise<void>;
}

interface AuthResponse {
  accessToken: string;
  expiresAt: number;
  user: User;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    api
      .get<User>('/me/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('accessToken');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (data: LoginInput) => {
    const res = await api.post<AuthResponse>('/auth/login', data);
    localStorage.setItem('accessToken', res.data.accessToken);
    setUser(res.data.user);
    navigate('/dashboard');
  }, [navigate]);

  const register = useCallback(async (data: UserInput) => {
    await api.post('/auth/register', data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
      navigate('/login');
    }
  }, [navigate]);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, logout, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
