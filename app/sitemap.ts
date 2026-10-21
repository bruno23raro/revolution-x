import type { MetadataRoute } from 'next';

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://revolutionx.com.br';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/register', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/login', priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/forgot-password', priority: 0.3, changeFrequency: 'monthly' as const },
    { path: '/verify-email', priority: 0.2, changeFrequency: 'monthly' as const },
  ];
  const lastModified = new Date();
  return routes.map((r) => ({
    url: `${ORIGIN}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
