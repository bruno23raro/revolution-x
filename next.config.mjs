/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nextConfig = {
  poweredByHeader: false,
  // Deploy Hostinger: output standalone reduz drasticamente o tamanho do
  // artefato (apenas .next/standalone) e inclui sÃ³ as deps de runtime.
  // Evita node_modules ausente/completa no servidor. `npm start` via PM2.
  output: 'standalone',
  webpack: (config, { isServer }) => {
    // O alias @/* Ã© resolvido pelo tsconfig paths (./src/*). NÃ£o sobrescrevemos
    // o alias '@' com a raiz aqui, pois isso quebrava @/components e @/lib.
    config.externals = config.externals || [];
    config.externals.push({
      ioredis: 'commonjs ioredis',
    });

    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};
export default nextConfig;