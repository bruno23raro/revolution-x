'use client';

import { useCallback, useEffect, useState } from 'react';

export interface User {
  id: string;
  email: string;
  organizationId: string;
  role: 'admin' | 'member' | 'viewer';
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const loadUser = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await fetch('/api/auth/session');
      if (!r.ok) {
        setState({ user: null, loading: false, error: null });
        return;
      }
      const d = await r.json();
      if (d.user) {
        setState({ user: d.user, loading: false, error: null });
      } else {
        setState({ user: null, loading: false, error: null });
      }
    } catch (e) {
      setState({
        user: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Falha ao carregar usuário',
      });
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  return { ...state, user: state.user, reload: loadUser };
}