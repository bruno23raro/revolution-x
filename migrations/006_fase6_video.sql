=== FASE 6 — MIGRAÇÃO ===
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
