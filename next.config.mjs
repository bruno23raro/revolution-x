/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nextConfig = {
  poweredByHeader: false,
  // Deploy Hostinger: output standalone reduz drasticamente o tamanho do
  // artefato (apenas .next/standalone) e inclui só as deps de runtime.
  // Evita node_modules ausente/completa no servidor. `npm start` via PM2.
  output: 'standalone',
  webpack: (config, { isServer }) => {
    config.resolve.alias['@'] = __dirname;

    // ioredis só é usado no servidor (APIs de rota). Impedir que o webpack
    // tente empacotá-lo no cliente, onde `node:diagnostics_channel` não existe
    // no webpack 5 do Next.js 14 (Node.js 24 incompatível).
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
