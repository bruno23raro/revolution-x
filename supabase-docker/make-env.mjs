// Monta supabase-docker/.env a partir de .secrets.json + portas remapeadas.
import { readFileSync, writeFileSync } from 'node:fs';

const s = JSON.parse(readFileSync('.secrets.json', 'utf8'));

const env = {
  POSTGRES_HOST: 'db',
  POSTGRES_DB: 'postgres',
  POSTGRES_PASSWORD: s.POSTGRES_PASSWORD,
  // OFICIAL: db escuta internamente em ${POSTGRES_PORT} e supavisor publica ${POSTGRES_PORT}:5432.
  // Host tem PG local em 5432 -> usar 54320 ponta-a-ponta (db escuta 54320, todos conectam db:54320).
  POSTGRES_PORT: '54320',
  POOLER_PROXY_PORT_TRANSACTION: '65430',
  API_GW_HTTP_PORT: '8432',

  JWT_EXPIRY: '3600',
  JWT_SECRET: s.JWT_SECRET,
  ANON_KEY: s.ANON_KEY,
  SERVICE_ROLE_KEY: s.SERVICE_ROLE_KEY,
  SUPABASE_PUBLISHABLE_KEY: '',
  SUPABASE_SECRET_KEY: '',

  SECRET_KEY_BASE: s.SECRET_KEY_BASE,
  VAULT_ENC_KEY: s.VAULT_ENC_KEY,
  PG_META_CRYPTO_KEY: s.PG_META_CRYPTO_KEY,
  REALTIME_DB_ENC_KEY: s.REALTIME_DB_ENC_KEY,
  DASHBOARD_USERNAME: s.DASHBOARD_USERNAME,
  DASHBOARD_PASSWORD: s.DASHBOARD_PASSWORD,

  SITE_URL: 'http://localhost:3000',
  API_EXTERNAL_URL: 'http://localhost:8432',
  SUPABASE_PUBLIC_URL: 'http://localhost:8432',
  ADDITIONAL_REDIRECT_URLS: 'http://localhost:3000/**',
  DISABLE_SIGNUP: 'false',
  ENABLE_EMAIL_SIGNUP: 'true',
  ENABLE_EMAIL_AUTOCONFIRM: 'true', // dev local: sem SMTP
  ENABLE_ANONYMOUS_USERS: 'false',
  ENABLE_PHONE_SIGNUP: 'false',
  ENABLE_PHONE_AUTOCONFIRM: 'false',
  SMTP_ADMIN_EMAIL: 'admin@example.local',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '2500',
  SMTP_USER: 'fake',
  SMTP_PASS: 'fake',
  SMTP_SENDER_NAME: 'RevX Local',
  MAILER_URLPATHS_INVITE: '/auth/v1/verify',
  MAILER_URLPATHS_CONFIRMATION: '/auth/v1/verify',
  MAILER_URLPATHS_RECOVERY: '/auth/v1/verify',

  PGRST_DB_SCHEMAS: 'public,storage,graphql_public',
  PGRST_DB_MAX_ROWS: '1000',
  PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions',

  STUDIO_DEFAULT_ORGANIZATION: 'RevolutionX',
  STUDIO_DEFAULT_PROJECT: 'revx-local',
  OPENAI_API_KEY: '',

  GLOBAL_S3_BUCKET: 'storage',
  STORAGE_TENANT_ID: 'stub',
  REGION: 'local',
  IMGPROXY_AUTO_WEBP: 'true',
  FUNCTIONS_VERIFY_JWT: 'false',

  S3_PROTOCOL_ACCESS_KEY_ID: s.S3_PROTOCOL_ACCESS_KEY_ID,
  S3_PROTOCOL_ACCESS_KEY_SECRET: s.S3_PROTOCOL_ACCESS_KEY_SECRET,

  POOLER_TENANT_ID: 'revx-local',
  POOLER_DEFAULT_POOL_SIZE: '20',
  POOLER_MAX_CLIENT_CONN: '100',
  POOLER_DB_POOL_SIZE: '5',
};

const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
writeFileSync('.env', lines.join('\n') + '\n', { encoding: 'ascii' });
console.log('.env gravado com', lines.length, 'variaveis');
