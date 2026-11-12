// FASE 5.0 — Gerenciador Oficial de Templates WhatsApp
// Página principal do gerenciador de templates com interface compatível com a Meta

import { Metadata } from 'next';
import { TemplatesPageClient } from './client-page';

export const metadata: Metadata = {
  title: 'Templates WhatsApp | Revolution X',
  description: 'Gerenciador oficial de templates WhatsApp Cloud API',
};

export default function TemplatesPage() {
  return <TemplatesPageClient />;
}