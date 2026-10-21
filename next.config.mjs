/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
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
