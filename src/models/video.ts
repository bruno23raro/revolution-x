// FASE 6 — Video (mídia de vídeo)
// Baseado no README: Fase 6 = Vídeo
// Funcionalidade inequívoca para SaaS omnichannel
// Status: IMPLEMENTADO (interf/interface)

export interface Video {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  url?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  createdAt: string;
}

export interface VideoInput {
  title?: string;
  description?: string;
  url?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
}
