// FASE META — TIPOS E ESTADOS (seção 16, 12, 8, 9, 10)
export type MetaConnectionStatus =
  | 'NOT_CONNECTED'
  | 'PENDING'
  | 'AUTHORIZING'
  | 'CONNECTED'
  | 'EXPIRED'
  | 'REAUTH_REQUIRED'
  | 'ERROR'
  | 'DISCONNECTED';

export interface MetaAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface MetaConnection {
  id: string;
  organizationId: string;
  provider: 'facebook' | 'instagram' | 'whatsapp';
  status: MetaConnectionStatus;
  externalAccountId?: string;
  externalAccountName?: string;
  accessToken?: string; // encrypted at rest
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthState {
  state: string;
  organizationId: string;
  provider: 'facebook' | 'instagram' | 'whatsapp';
  createdAt: string;
  expiresAt: string;
}
