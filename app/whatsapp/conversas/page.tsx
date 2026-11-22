// FASE 5.2 — Página de conversas WhatsApp (Inbox em tempo real)

import { Metadata } from 'next';
import Inbox from '@/app/whatsapp/Inbox';

export const metadata: Metadata = {
  title: 'Conversas WhatsApp | Revolution X',
  description: 'Inbox em tempo real para mensagens WhatsApp Business API',
};

export default function ConversasPage() {
  return <Inbox />;
}