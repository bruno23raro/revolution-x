import './globals.css';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#08090d',
};

export const metadata: Metadata = {
  title: 'Revolution X — Sua operação em movimento',
  description: 'Plataforma operacional omnichannel para centralizar relacionamento, vendas, conteúdo e automação.',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="facebook-domain-verification" content="34j2yr0b919ahe1fw0phzg9ubwvile" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
