import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, refreshSession, setAccessToken, type AuthResponse, type SessionUser } from "../lib/api";

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { firmName: string; name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  acceptInvite: (data: { token: string; name: string; password: string }) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    refreshSession().then((s) => {
      if (!active) return;
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const apply = (d: AuthResponse) => {
    setAccessToken(d.accessToken);
    setUser(d.user);
  };

  const value: AuthCtx = {
    user,
    loading,
    login: async (email, password) => apply((await api.post<AuthResponse>('/auth/login', { email, password })).data),
    signup: async (data) => apply((await api.post<AuthResponse>('/auth/signup', data)).data),
    logout: async () => {
      await api.post('/auth/logout').catch(() => {});
      setAccessToken(null);
      setUser(null);
    },
    acceptInvite: async (data) => apply((await api.post<AuthResponse>('/auth/accept-invite', data)).data),
  };

return <Ctx.Provider value={value}>{children}</Ctx.Provider>;}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};