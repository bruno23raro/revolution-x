// Hook para buscar contas de integração agrupadas por canal.
// Multi-conta: cada canal pode ter N contas (oficiais + manuais).
// Nunca retorna tokens.
'use client';

import { useCallback, useEffect, useState } from 'react';

export interface AccountRow {
  id: string;
  channel: string;
  mode: 'OFFICIAL' | 'MANUAL';
  status: string;
  metaAccountId: string | null;
  metaAccountName: string | null;
  label: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  phoneNumber?: string | null;
  wabaId?: string | null;
  tokenExpiresAt?: string | null;
}

export interface StatusData {
  connected: boolean;
  integrations: AccountRow[];
}

interface UseState {
  loading: boolean;
  error: string | null;
  data: StatusData | null;
}

export function useIntegrationAccounts() {
  const [state, setState] = useState<UseState>({
    loading: true,
    error: null,
    data: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await fetch('/api/integrations/status');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as StatusData;
      setState({ loading: false, error: null, data: d });
    } catch (e) {
      setState({
        loading: false,
        error: e instanceof Error ? e.message : 'Falha ao carregar integrações',
        data: null,
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}