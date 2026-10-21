import './globals.css';
import type { Metadata, Viewport } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://revolutionx.com.br';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#08090d',
};

export const metadata: Metadata = {
  // Base p/ URLs canônicas e OG (o host canônico é o apex, nunca o www).
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Revolution X — Sua operação em movimento',
    template: '%s | Revolution X',
  },
  description: 'Plataforma operacional omnichannel para centralizar relacionamento, vendas, conteúdo e automação.',
  alternates: {
    canonical: '/',
  },
  // Padrão para TODAS as páginas: não indexar (rotas de app/tenant expõem
  // 200 para o crawler sem dados — devem permanecer fora do índice).
  // Páginas públicas optam in com robots: { index: true } próprio
  // (landing, login, register, forgot-password, verify-email).
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Revolution X',
    url: SITE_URL,
    title: 'Revolution X — Sua operação em movimento',
    description: 'Plataforma operacional omnichannel para centralizar relacionamento, vendas, conteúdo e automação.',
    // TODO (passo humano/design): publicar public/og-image.png (1200x630) e
    // habilitar -> images: [{ url: '/og-image.png', width: 1200, height: 630 }].
    // Hoje só existe public/favicon.svg; apontar uma imagem inexistente
    // quebraria o preview social (404 na rasura).
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="facebook-domain-verification" content="34j2yr0b919ahe1fw0phzg9ubwvile" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
