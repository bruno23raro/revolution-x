/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nextConfig = {
  poweredByHeader: false,
  webpack: (config) => {
    config.resolve.alias['@'] = __dirname;
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // HSTS: reforça o https no app (o http→https 301 já existe na borda
          // Hostinger). Cabeçalho entregue por respostas https não afeta a
          // execução local (browsers só aceitam HSTS de respostas https).
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};
export default nextConfig;
