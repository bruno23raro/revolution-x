import ScraperPageLayout from '@/components/scrappers/ScraperPageLayout';

const icon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function GoogleMapsScraperPage() {
  return (
    <ScraperPageLayout
      title="Google Maps Scraper"
      description="Extrai dados de empresas do Google Maps: nome, endereço, telefone, avaliação e reviews."
      icon={icon}
      fields={[
        { name: 'keyword', label: 'Palavra-chave', placeholder: 'Ex: restaurantes,Advogados' },
        { name: 'city', label: 'Cidade', placeholder: 'Ex: São Paulo' },
      ]}
    />
  );
}