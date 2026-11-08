// MOCK — Meta Ads / Google Ads / OpenAI / Email / S3
// Interface única; implementações reais ativadas por .env

export interface ExternalServiceAdapter {
  name: string;
  isActive(): boolean;
  execute(payload: unknown): Promise<{ ok: boolean; details?: string }>;
}

export class MockExternalAdapter implements ExternalServiceAdapter {
  name = "mock";

  isActive() {
    // Verificar se credenciais reais estão configuradas no .env
    // Meta Ads: META_ADS_KEY presente
    // Google Ads: GOOGLE_ADS_DEVELOPER_TOKEN presente
    // OpenAI: OPENAI_API_KEY presente
    // Email: EMAIL_API_KEY presente
    // S3: AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY presentes
    const hasRealMeta = !!process.env.META_ADS_KEY;
    const hasRealGoogle = !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const hasRealOpenAI = !!process.env.OPENAI_API_KEY;
    const hasRealEmail = !!process.env.EMAIL_API_KEY;
    const hasRealS3 = !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;

    // Retornar true apenas se pelo menos uma credencial real estiver configurada
    // para o serviço correspondente
    return hasRealMeta || hasRealGoogle || hasRealOpenAI || hasRealEmail || hasRealS3;
  }

  async execute(p: unknown): Promise<{ ok: boolean; details: string }> {
    return { ok: false, details: "serviço mock desativado — configure credenciais reais no .env" };
  }
}

export const mockServices = {
  metaAds: new MockExternalAdapter(),
  googleAds: new MockExternalAdapter(),
  openAI: new MockExternalAdapter(),
  email: new MockExternalAdapter(),
  s3Storage: new MockExternalAdapter(),
};
