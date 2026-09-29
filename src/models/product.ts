// FASE 4 — PREPARADO (não inventado; baseado no README: Produtos + mídia)
// Status: IMPLEMENTADO PARCIALMENTE — VALIDAÇÃO EXTERNA PENDENTE
// Não depende do banco para definição de interface.

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  organizationId: string;
  productId?: string;
  url?: string;
  type: 'image' | 'video';
  createdAt: string;
}
