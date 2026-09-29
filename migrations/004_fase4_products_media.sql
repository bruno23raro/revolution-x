=== MIGRAÇÃO 004 — FASE 4 (PREPARADA, NÃO EXECUTADA) ===
-- FASE 4 — Produtos + mídia
-- Status: PREPARADO — NÃO EXECUTADO (autorização necessária)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
-- RLS: habilitar quando banco confirmado (não executado agora)
