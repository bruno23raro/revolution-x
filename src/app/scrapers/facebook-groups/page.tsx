import ScraperPageLayout from '@/components/scrappers/ScraperPageLayout';

const icon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10-4a3 3 0 00-5.356-1.857M7 20H2v-6a6 6 0 0118-3.712M14 14a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

export default function FacebookGroupsScraperPage() {
  return (
    <ScraperPageLayout
      title="Facebook Groups Scraper"
      description="Extrai membros, interações e informações de grupos do Facebook."
      icon={icon}
      fields={[
        { name: 'url', label: 'URL do Grupo', placeholder: 'https://facebook.com/grupos/...' },
        { name: 'keyword', label: 'Palavra-chave (opcional)', placeholder: 'Filtrar por palavra-chave' },
      ]}
    />
  );
}