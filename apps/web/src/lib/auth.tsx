import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { get, post, tokenStore } from './api';

export type Role = 'SUPER_ADMIN' | 'LEAGUE_OWNER' | 'LEAGUE_STAFF' | 'TEAM_OWNER' | 'PLAYER' | 'VENDOR' | 'SPONSOR' | 'TALENT_AGENT';
export interface User {
  id: string; email: string; name: string; phone?: string; role: Role; avatarUrl?: string;
  vendorProfile?: { id: string; companyName: string } | null;
  sponsorProfile?: { id: string; companyName: string } | null;
  subscriptions?: { plan: string; amount: number; status: string; validTill: string }[];
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: Record<string, unknown>) => Promise<User>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());
  const qc = useQueryClient();

  useEffect(() => {
    if (!tokenStore.get()) return;
    get<User>('/auth/me').then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const handle = (r: { token: string; user: User }) => { tokenStore.set(r.token); qc.clear(); setUser(r.user); return r.user; };

  return (
    <Ctx.Provider value={{
      user, loading,
      login: (email, password) => post('/auth/login', { email, password }).then(handle),
      register: (data) => post('/auth/register', data).then(handle),
      logout: () => { tokenStore.clear(); qc.clear(); setUser(null); },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

/** Where each role lands after login */
export const homeFor = (role: Role) =>
  ({ SUPER_ADMIN: '/admin', LEAGUE_OWNER: '/leagues', LEAGUE_STAFF: '/leagues', TEAM_OWNER: '/leagues', PLAYER: '/player', VENDOR: '/vendor', SPONSOR: '/sponsor', TALENT_AGENT: '/agent' })[role];
