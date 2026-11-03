// Escopos padrão para OAuth Meta (Facebook/Instagram/WhatsApp).
// Mantidos em um arquivo separado para serem importados por rotas sem conflito
// com as restrições de exportação do Next.js App Router.
// 9 scopes mantidos para Meta App Review: todos com uso confirmado no código.

export const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
  'ads_read',
  'pages_read_engagement',
  'pages_manage_ads',
];

