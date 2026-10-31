export type ScraperRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ScrapeResult {
  ok: boolean;
  data?: any;
  error?: string;
  errorDetail?: string;
  riskLevel: ScraperRiskLevel;
  sessionId: string;
  timestamp: string;
}

export interface RiskLog {
  id: string;
  userId: string;
  action: string;
  platform: 'instagram' | 'facebook' | 'whatsapp' | 'google';
  target: string;
  riskLevel: ScraperRiskLevel;
  context: any;
  result: 'success' | 'failed' | 'blocked';
  timestamp: string;
  organizationId: string;
}

export interface ScraperConfig {
  platform: string;
  maxResults?: number;
  rateLimitMs?: number;
  proxyUrl?: string;
  timeoutMs?: number;
}