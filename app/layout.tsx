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
    // Facebook App ID para integração social (vindo de .env.local via process.env)
    ...(process.env.NEXT_PUBLIC_META_APP_ID && { appId: process.env.NEXT_PUBLIC_META_APP_ID }),
    // ... demais OG configs
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

// Facebook SDK async initialization
function loadFacebookSDK(appId: string): void {
  if (typeof window !== 'undefined') {
    // Only load if not already loaded and we have an app ID
    const alreadyLoaded = (window as any).facebookAsyncLoaded;
    if (!alreadyLoaded && appId) {
      (window as any).facebookAsyncLoaded = true;
      // Load the Facebook SDK async
      const js = document.createElement('script');
      js.id = 'facebook-jssdk';
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      js.async = true;
      js.dataset.appId = appId;
      // Execute after load
      js.onload = () => {
        // SDK loaded, FB is available globally
        // The window.fbAsyncInit will be called by the SDK
      };
      // Insert script after first child (safely handle null cases)
      const firstChild = document.documentElement.firstChild;
      if (firstChild && firstChild.parentNode) {
        firstChild.parentNode.insertBefore(js, firstChild.nextSibling);
      } else {
        const head = document.head;
        if (head) {
          head.appendChild(js);
        }
      }
    }
  }
}

// Initialize Facebook SDK on DOMContentLoaded
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadFacebookSDK(process.env.NEXT_PUBLIC_META_APP_ID || ''));
  } else {
    loadFacebookSDK(process.env.NEXT_PUBLIC_META_APP_ID || '');
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="facebook-domain-verification" content="y5taj86mle4eji96jz4ldkdf2vt49e" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* Facebook SDK async script — loads on client only, injected via Next.js dynamic import pattern */}
        {/* O script é inserido via useEffect no componente client-side quando necessário */}
      </head>
      <body>{children}</body>
    </html>
  );
}
