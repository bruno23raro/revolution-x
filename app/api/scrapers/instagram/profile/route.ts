import { InstagramProfileScraper } from '@/modules/scrapers/instagram';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const username = body?.username;
    if (typeof username !== 'string' || username.trim() === '') {
      return new Response(JSON.stringify({ error: 'username required' }), { status: 400 });
    }

    const scraper = new InstagramProfileScraper({ userId: 'placeholder', rateLimitMs: 12000 });

    const result = await scraper.scrapeProfile(username.trim());

    // Log risk level
    console.log('Instagram scrape riskLevel:', result.riskLevel);

    if (!result.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: result.error,
        detail: result.errorDetail,
        riskLevel: result.riskLevel
      }), { status: 400 });
    }

    return new Response(JSON.stringify({
      ok: true,
      data: result.data,
      riskLevel: result.riskLevel
    }), { status: 200 });
  } catch (e) {
    console.error('Error in Instagram profile route', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }
}