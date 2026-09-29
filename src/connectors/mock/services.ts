// MOCK — Meta Ads / Google Ads / OpenAI / Email / S3
// Interface única; implementações reais ativadas por .env

export interface ExternalServiceAdapter {
  name: string;
  isActive(): boolean;
  execute(payload: unknown): Promise<{ ok: boolean; details?: string }>;
}

export class MockExternalAdapter implements ExternalServiceAdapter {
  name = "mock";
  isActive() { return true; }
  async execute(p: unknown): Promise<{ ok: boolean; details: string }> {
    return { ok: true, details: "simulado — chave real não configurada" };
  }
}

export const mockServices = {
  metaAds: new MockExternalAdapter(),
  googleAds: new MockExternalAdapter(),
  openAI: new MockExternalAdapter(),
  email: new MockExternalAdapter(),
  s3Storage: new MockExternalAdapter(),
};
