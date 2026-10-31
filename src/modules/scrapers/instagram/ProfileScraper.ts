import { scrapePublicUrl, ScrapeResult as PublicScrapeResult } from '@/integrations/publicScraper';

export interface InstagramProfileData {
  username: string;
  fullName: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isPrivate: boolean;
  bio: string;
  externalUrl: string | null;
  scrapedAt: string;
}

export interface ScrapeResult<T> {
  ok: boolean;
  data?: T;
  error?: 'not_found' | 'private' | 'forbidden' | 'timeout' | 'network_error' | 'rate_limit';
  errorDetail?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export class InstagramProfileScraper {
  constructor(private config: { userId: string; rateLimitMs?: number }) {}

  async scrapeProfile(username: string): Promise<ScrapeResult<InstagramProfileData>> {
    const url = `https://www.instagram.com/${username}/`;
    const result = await scrapePublicUrl(url, { timeoutMs: 5000, maxBytes: 500_000 });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error === 'forbidden' ? 'forbidden' :
               result.error === 'timeout' ? 'timeout' :
               result.error === 'network_error' ? 'network_error' : 'not_found',
        errorDetail: result.errorDetail,
        riskLevel: 'medium',
      };
    }

    const parsed = this.parseProfileHtml(result.html!, username);
    if (!parsed) {
      return {
        ok: false,
        error: 'not_found',
        errorDetail: 'Profile not found or invalid HTML structure',
        riskLevel: 'medium',
      };
    }

    return { ok: true, data: parsed, riskLevel: 'medium' };
  }

  private parseProfileHtml(html: string, username: string): InstagramProfileData | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const privateNotice = doc.querySelector('[data-private-member]');
      if (privateNotice) {
        return {
          username,
          fullName: '',
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          isPrivate: true,
          bio: '',
          externalUrl: null,
          scrapedAt: new Date().toISOString(),
        };
      }

      const fullName = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.replace(' • Instagram', '') || '';

      const followersMatch = html.match(/(?<="edge_followed_by":\s*\{\s*"count":\s*)(\d+)(?=\})/);
      const followersCount = followersMatch ? parseInt(followersMatch[1]) : 0;

      const followingMatch = html.match(/(?<="edge_friend_of_you":\s*\{\s*"count":\s*)(\d+)(?=\})/);
      const followingCount = followingMatch ? parseInt(followingMatch[1]) : 0;

      const postsMatch = html.match(/(?<="edge_owner_to_timeline_media":\s*\{\s*"count":\s*)(\d+)(?=\})/);
      const postsCount = postsMatch ? parseInt(postsMatch[1]) : 0;

      const bioElement = doc.querySelector('meta[name="description"]');
      const bio = bioElement?.getAttribute('content') || '';

      const urlElement = doc.querySelector('a[href^="http"]');
      const externalUrl = urlElement?.getAttribute('href') || null;

      return {
        username,
        fullName,
        followersCount,
        followingCount,
        postsCount,
        isPrivate: false,
        bio,
        externalUrl,
        scrapedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async scrapeFollowers(username: string, limit?: number): Promise<Array<{
    username: string;
    fullName: string;
    isVerified: boolean;
    followers?: number;
  }>> {
    // Conceptual; would use Playwright in production
    return [];
  }
}