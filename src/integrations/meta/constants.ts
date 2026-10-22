// Escopos padrão para OAuth Meta (Facebook/Instagram/WhatsApp).
// Mantidos em um arquivo separado para serem importados por rotas sem conflito
// com as restrições de exportação do Next.js App Router.

export const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
];

