"use client";

// Página principal de integrações — Grid único com 6 cards parametrizados via IntegrationCard.
// Estado lido do banco via getByChannel. Modo (official/non_official) controlado por seletor
// e refletido em ?mode= na URL. Sem lógica condicional duplicada por card.

import AppShell from '@/components/AppShell';
import IntegrationCard from '@/components/integrations/IntegrationCard';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// Configurações dos cards por modo
type CardConfig = {
  channel: 'whatsapp' | 'instagram' | 'facebook';
  mode: 'OFFICIAL' | 'MANUAL';
  title: string;
  subtitle: string;
  icon: ReactNode;
  defaultOnConnect?: () => void;
};

const OFFICIAL_CARDS: CardConfig[] = [
  {
    channel: 'whatsapp',
    mode: 'OFFICIAL',
    title: 'WhatsApp Oficial',
    subtitle: 'API Oficial — Cloud API via OpenBSP',
    icon: (
      <svg
        className="w-6 h-6 text-green-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9 9 0 01-9-9c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    defaultOnConnect: () => console.log('WhatsApp Oficial: conectar via OpenBSP'),
  },
  {
    channel: 'instagram',
    mode: 'OFFICIAL',
    title: 'Instagram Oficial',
    subtitle: 'Graph API — Meta OAuth',
    icon: (
      <svg
        className="w-6 h-6 text-pink-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9 9 0 01-9-9c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    defaultOnConnect: () => console.log('Instagram Oficial: configurar credenciais'),
  },
  {
    channel: 'facebook',
    mode: 'OFFICIAL',
    title: 'Facebook Oficial',
    subtitle: 'Graph API — Meta OAuth',
    icon: (
      <svg
        className="w-6 h-6 text-blue-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9 9 0 01-9-9c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    defaultOnConnect: () => console.log('Facebook Oficial: conectar conta'),
  },
];

const EXTRACTION_CARDS: CardConfig[] = [
  {
    channel: 'whatsapp',
    mode: 'MANUAL',
    title: 'WhatsApp Manual',
    subtitle: 'Evolution API / QR Code',
    icon: (
      <svg
        className="w-6 h-6 text-orange-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9 9 0 01-9-9c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    defaultOnConnect: () => console.log('WhatsApp Manual: gerar QR Code'),
  },
  {
    channel: 'instagram',
    mode: 'MANUAL',
    title: 'Instagram Manual',
    subtitle: 'Session Login (Playwright)',
    icon: (
      <svg
        className="w-6 h-6 text-orange-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9 9 0 01-9-9c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    defaultOnConnect: () => console.log('Instagram Manual: login via session'),
  },
  {
    channel: 'facebook',
    mode: 'MANUAL',
    title: 'Facebook Manual',
    subtitle: 'Session Login (Playwright)',
    icon: (
      <svg
        className="w-6 h-6 text-blue-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9 9 0 01-9-9c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    defaultOnConnect: () => console.log('Facebook Manual: login via session'),
  },
];

// Função auxiliar para obter configuração do card baseada no modo
function getCardConfigs(mode: 'OFFICIAL' | 'MANUAL'): CardConfig[] {
  return mode === 'OFFICIAL' ? OFFICIAL_CARDS : EXTRACTION_CARDS;
}

export default function IntegracoesPage() {
  // Parse modo da querystring ?mode=... usando URLSearchParams nativo
  const stored = typeof window !== 'undefined' ? window.location.search : '';
  const mode = stored.includes('mode=MANUAL')
    ? 'MANUAL'
    : stored.includes('mode=OFFICIAL')
      ? 'OFFICIAL'
      : 'OFFICIAL';

  // Sincroniza modo na URL quando mudar
  useEffect(() => {
    // Atualiza a querystring preservando outros params
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('mode', mode);
    const newSearch = searchParams.toString();
    const newUrl = `${window.location.pathname}?${newSearch}`;
    // Só atualiza se o URL realmente mudou
    if (window.location.href !== newUrl) {
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  }, [mode]);

  const cardConfigs = getCardConfigs(mode);

  return (
    <AppShell>
      <main className="min-h-screen bg-[#05020A] p-4 sm:p-8">
        <div className="mx-auto max-w-5xl">

          {/* Header com seletor de modo */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white">
              Revolution X - Integrações
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Conecte suas contas de automação de marketing
            </p>

            {/* Seletor de modo */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  const newMode: 'OFFICIAL' | 'MANUAL' = mode === 'OFFICIAL' ? 'MANUAL' : 'OFFICIAL';
                  // Atualiza a querystring manualmente
                  const currentSearch = window.location.search;
                  const newSearch = currentSearch.replace(/mode=[^&]*/, `mode=${newMode}`);
                  const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
                  // Atualiza URL — pushState retorna void, ignoramos o retorno
                  if (window.location.href !== newUrl) {
                    ;(window.history as any).pushState({ path: newUrl }, '', newUrl);
                  }
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  mode === 'OFFICIAL' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'text-gray-400'}
                }`}
                aria-label="Modo oficial"
              >
                Oficial
              </button>
              <button
                onClick={() => {
                  const newMode: 'OFFICIAL' | 'MANUAL' = mode === 'OFFICIAL' ? 'MANUAL' : 'OFFICIAL';
                  // Atualiza a querystring manualmente
                  const currentSearch = window.location.search;
                  const newSearch = currentSearch.replace(/mode=[^&]*/, `mode=${newMode}`);
                  const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
                  // Atualiza URL — pushState retorna void, ignoramos o retorno
                  if (window.location.href !== newUrl) {
                    ;(window.history as any).pushState({ path: newUrl }, '', newUrl);
                  }
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  mode === 'MANUAL' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'text-gray-400'}
                }`}
                aria-label="Modo manual"
              >
                Manual
              </button>
            </div>
          </div>

          {/* Grid de 6 cards — 3 por linha em desktop, auto-fit em mobile */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              🔒 INTEGRAÇÕES OFICIAIS (Secure)
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 auto-rows-fr">
              {cardConfigs.slice(0, 3).map((card, idx) => (
                <IntegrationCard
                  key={idx}
                  channel={card.channel}
                  mode={mode}
                  title={card.title}
                  subtitle={card.subtitle}
                  icon={card.icon}
                  onDisconnect={() => card.defaultOnConnect?.()}
                />
              ))}
            </div>
          </section>

          {/* Segunda linha: cards de extração */}
          <section>
            <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              ⚠️ EXTRACAO DE DADOS
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 auto-rows-fr">
              {/* Cards de extração (modo MANUAL a partir do índice 3) */}
              {cardConfigs.slice(3).map((card, idx) => (
                <IntegrationCard
                  key={idx + 10}
                  channel={card.channel}
                  mode={mode}
                  title={card.title}
                  subtitle={card.subtitle}
                  icon={card.icon}
                  onDisconnect={() => card.defaultOnConnect?.()}
                />
              ))}

              {/* Card extra TikTok */}
              <IntegrationCard
                key={14}
                channel="whatsapp"
                mode={mode}
                title="TikTok OAuth"
                subtitle="Em desenvolvimento"
                icon={
                  <div className="h-10 w-10 rounded-lg bg-gray-800/50 flex items-center justify-center text-gray-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-8.92A2 2 0 009.183 2h5.634l-1.76 4.88a2 2 0 001.12 2.953h4.265l-2.081.633a2 2 0 01-2.137 1.687l-.095.325-5.058 1.52a2 2 0 01-2.132-2H7.358l2.728-5.375z"
                      />
                    </svg>
                  </div>
                }
              />

              {/* Card extra Google Maps */}
              <IntegrationCard
                key={15}
                channel="instagram"
                mode={mode}
                title="Google Maps Scraper"
                subtitle="Extraia dados de empresas"
                icon={
                  <div className="h-10 w-10 rounded-lg bg-gray-800/50 flex items-center justify-center text-gray-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                    </svg>
                  </div>
                }
              />

              {/* Card extra Facebook Groups */}
              <IntegrationCard
                key={16}
                channel="facebook"
                mode={mode}
                title="Facebook Groups Scraper"
                subtitle="Extraia membros e info"
                icon={
                  <div className="h-10 w-10 rounded-lg bg-gray-800/50 flex items-center justify-center text-gray-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10-4a3 3 0 00-5.356-1.857M7 20H2v-6a6 6 0 0118-3.712M14 14a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                }
              />
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}