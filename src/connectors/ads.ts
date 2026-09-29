// FASE 9 — Ads Connector (preparado, não inventado)
// Baseado: README Fase 9 = Campanhas de tráfego pago
// Dependência externa: Meta Ads / Google Ads (credenciais + orçamento)
// Não inventa: campanhas específicas, segmentação de audiência, criativos
// Prepara: interface de campanha, configuração, documentação

export interface AdsConfig {
  platform: 'meta' | 'google';
  accountId?: string;
  accessToken?: string;
}

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  platform: 'meta' | 'google';
  status: 'draft' | 'active' | 'paused' | 'completed';
  budget?: number;
  createdAt: string;
}

export async function createCampaign(config: AdsConfig, campaign: Partial<Campaign>): Promise<{ success: boolean; id?: string; error?: string }> {
  // BLOQUEADO EXTERNAMENTE — credencial externa necessária
  return { success: false, error: 'BLOQUEADO — credencial Ads não fornecida (Meta/Google)' };
}
