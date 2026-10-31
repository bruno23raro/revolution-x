import ScraperPageLayout from '@/components/scrappers/ScraperPageLayout';

const icon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9 9 0 01-9-9c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

export default function WhatsAppGroupsScraperPage() {
  return (
    <ScraperPageLayout
      title="WhatsApp Groups Scraper"
      description="Extrai listas de grupos do WhatsApp por keyword e região."
      icon={icon}
      fields={[
        { name: 'keyword', label: 'Palavra-chave', placeholder: 'Ex: marketing, vendas' },
        { name: 'city', label: 'Cidade', placeholder: 'Ex: São Paulo' },
      ]}
    />
  );
}