"use client";

// Página principal de integrações — Grid responsivo com separação visual clara entre oficiais e de extração.
import AppShell from '@/components/AppShell';
import WhatsAppApiCard from '@/components/integrations/WhatsAppApiCard';
import WhatsAppQrCard from '@/components/integrations/WhatsAppQrCard';
import WhatsAppOfficialCard from '@/components/integrations/WhatsAppOfficialCard';
import InstagramCard from '@/components/integrations/InstagramCard';
import FacebookPagesCard from '@/components/integrations/FacebookPagesCard';
import RiskBanner from '@/components/RiskBanner';
import { IntegrationStatus } from '@/components/integrations/IntegrationCard';

// Componente para cards oficiais (seguro)
function OfficialCardWrapper({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative rounded-xl border-2 border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent p-4 transition-all hover:shadow-lg hover:shadow-green-500/20 ${className}`}>
      <div className="absolute -top-2 -right-2 z-10">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-[10px] font-semibold uppercase tracking-wide border border-green-500/30">
          ✅ API Oficial
        </span>
      </div>
      {children}
    </div>
  );
}

// Componente para cards de extração (risco)
function ExtractionCardWrapper({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative rounded-xl border-2 border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent p-4 transition-all hover:shadow-lg hover:shadow-red-500/20 ${className}`}>
      <div className="absolute -top-2 -right-2 z-10 flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-semibold uppercase tracking-wide border border-red-500/30">
          ⚠️ ALTO RISCO
        </span>
        <div className="text-[9px] py-1">
          <RiskBanner title="">
            Requer consentimento explícito para scraping.
          </RiskBanner>
        </div>
      </div>
      {children}
    </div>
  );
}

function getStatusForChannel(channel: string): IntegrationStatus {
  // Simular status para demonstração - na implementação real, isso seria buscado da API
  const isConnected = ['whatsapp', 'instagram', 'facebook'].includes(channel);
  return {
    connected: isConnected,
    error: isConnected ? undefined : 'Não conectado',
    accountRef: isConnected ? `••••${channel.slice(-4)}` : undefined,
  };
}

export default function IntegracoesPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-[#05020A] p-4 sm:p-8">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Revolution X - Integrações</h1>
            <p className="text-sm text-gray-400 mt-1">
              Conecte suas contas Meta, Instagram e Facebook para automação de marketing.
            </p>
          </div>

          {/* Integrações Oficiais (Seguro) */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              🔒 INTEGRAÇÕES OFICIAIS (Seguro)
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 auto-rows-fr">
              <OfficialCardWrapper>
                <WhatsAppApiCard
                  status={getStatusForChannel('whatsapp')}
                  onConnected={() => console.log('WhatsApp conectado')}
                />
              </OfficialCardWrapper>

              <OfficialCardWrapper>
                <InstagramCard
                  status={getStatusForChannel('instagram')}
                  onConnected={() => console.log('Instagram conectado')}
                />
              </OfficialCardWrapper>

              <OfficialCardWrapper>
                <FacebookPagesCard
                  status={getStatusForChannel('facebook')}
                  onConnected={() => console.log('Facebook conectado')}
                />
              </OfficialCardWrapper>

              <OfficialCardWrapper>
                <WhatsAppOfficialCard onConnected={() => console.log('WhatsApp Oficial conectado')} />
              </OfficialCardWrapper>

              <OfficialCardWrapper>
                <WhatsAppQrCard />
              </OfficialCardWrapper>
            </div>
          </section>

          {/* Ferramentas de Extração (Alto Risco) */}
          <section>
            <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              ⚠️ FERRAMENTAS DE EXTRAÇÃO (Alto Risco)
            </h2>

            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <RiskBanner title="Aviso de Segurança">
                As ferramentas de extração envolvem scraping de dados de redes sociais. Use apenas para fins autorizados e com consentimento explícito. Todo scraping deve respeitar os Termos de Serviço das plataformas e regulamentações de privacidade aplicáveis.
              </RiskBanner>
            </div>

            {/* Primeira linha: 3 cards */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mb-4 auto-rows-fr">
              <ExtractionCardWrapper>
                <a href="/scrapers/instagram-profile" className="block h-full">
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h18a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="text-white font-semibold mb-2">Insta Profile Scraper</h3>
                    <p className="text-xs text-gray-400">Extraia informações de perfis do Instagram</p>
                  </div>
                </a>
              </ExtractionCardWrapper>

              <ExtractionCardWrapper>
                <a href="/scrapers/facebook-groups" className="block h-full">
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10-4a3 3 0 00-5.356-1.857M7 20H2v-6a6 6 0 0118-3.712M14 14a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <h3 className="text-white font-semibold mb-2">Facebook Groups Scraper</h3>
                    <p className="text-xs text-gray-400">Extraia membros e informações de grupos</p>
                  </div>
                </a>
              </ExtractionCardWrapper>

              <ExtractionCardWrapper>
                <a href="/scrapers/whatsapp-groups" className="block h-full">
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9 9 0 01-9-9c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h3 className="text-white font-semibold mb-2">WhatsApp Groups Scraper</h3>
                    <p className="text-xs text-gray-400">Extraia listas de grupos do WhatsApp</p>
                  </div>
                </a>
              </ExtractionCardWrapper>
            </div>

            {/* Segunda linha: 3 cards */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 auto-rows-fr">
              <ExtractionCardWrapper>
                <a href="/scrapers/google-maps" className="block h-full">
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-white font-semibold mb-2">Google Maps Scraper</h3>
                    <p className="text-xs text-gray-400">Extraia dados de empresas do Google Maps</p>
                  </div>
                </a>
              </ExtractionCardWrapper>

              <ExtractionCardWrapper>
                <a href="/scrapers/mass-dm" className="block h-full">
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-white font-semibold mb-2">MASS DM/SCR Scraper</h3>
                    <p className="text-xs text-gray-400">Automação de mensagens em massa</p>
                  </div>
                </a>
              </ExtractionCardWrapper>

              <ExtractionCardWrapper>
                <div className="text-center py-6 opacity-50">
                  <div className="w-12 h-12 rounded-full bg-gray-500/20 text-gray-400 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-white font-semibold mb-2">TikTok OAuth</h3>
                  <p className="text-xs text-gray-400">Em desenvolvimento</p>
                </div>
              </ExtractionCardWrapper>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}