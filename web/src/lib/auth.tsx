import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

export interface User { id: string; email: string; name: string; phone: string | null; locale: string; createdAt: string }

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setUser((await api.get<{ user: User }>('/auth/me')).user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const value: AuthCtx = {
    user, loading, refresh,
    login: async (email, password) => setUser((await api.post<{ user: User }>('/auth/login', { email, password })).user),
    signup: async (name, email, password) => setUser((await api.post<{ user: User }>('/auth/signup', { name, email, password })).user),
    logout: async () => {
      await api.post('/auth/logout');
      setUser(null);
      localStorage.removeItem('sf_farm');
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
