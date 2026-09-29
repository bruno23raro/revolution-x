// FASE META — WHATSAPP BUSINESS (seção 10, 11, 15)
import { MetaConnectionStatus } from '../types';

export interface WhatsAppBusinessProfile {
  businessId: string;
  phoneNumber: string;
  phoneNumberId: string;
  businessName: string;
  verified: boolean;
}

export function buildWhatsAppOnboardingUrl(organizationId: string, redirectUri: string): string {
  // Embedded Signup / Meta authorization (official flow — no fake URL)
  return `https://business.whatsapp.com/embed?redirect_uri=${encodeURIComponent(redirectUri)}&org=${encodeURIComponent(organizationId)}`;
}

export function getWhatsAppStatusLabel(status: MetaConnectionStatus): string {
  return status === 'CONNECTED' ? 'CONECTADO ✓' : status === 'PENDING' ? 'PENDING' : 'NÃO CONECTADO';
}
