import type { MetadataRoute } from 'next';

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://revolutionx.com.br';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard',
          '/crm',
          '/reports',
          '/calendar',
          '/publisher',
          '/video',
          '/account',
          '/integrations',
          '/facebook',
          '/instagram',
          '/whatsapp',
          '/tiktok',
          '/testcenter',
          '/onboarding/',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}
