// Escopos padrão para OAuth Meta (Facebook/Instagram/WhatsApp).
// Mantidos em um arquivo separado para serem importados por rotas sem conflito
// com as restrições de exportação do Next.js App Router.
// 9 scopes mantidos para Meta App Review: 7 Level A (essenciais) + 2 Level B (dependências obrigatórias)

export const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
  'pages_read_user_content',
  'whatsapp_business_management',
  'ads_read',
  'pages_read_engagement',
  'pages_manage_ads',
];

