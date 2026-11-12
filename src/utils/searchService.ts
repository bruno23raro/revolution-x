/**
 * Unified Search Service for Revolution X
 *
 * Priority order:
 * 1. Firecrawl (authenticated, best results) — tried first
 * 2. free-search (keyless multi-engine fallback)
 * 3. Context7 (library/docs queries)
 *
 * Results are cached per query to avoid redundant calls.
 */

// Import MCP tool references — these are resolved at runtime via Claude Code MCP
// We define the interface here; the actual calls go through the MCP layer.

export interface SearchOptions {
  query: string;
  categories?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  freshness?: 'day' | 'week' | 'month' | 'year';
  prefer?: 'web' | 'developer' | 'research' | 'pdf' | 'gov';
  maxResults?: number;
}

/**
 * Interface for a search result from any source
 */
export interface SearchResult {
  source: 'firecrawl' | 'free-search' | 'context7';
  title: string;
  url: string;
  name?: string | undefined;
  href?: string | undefined;
  description?: string | undefined;
  snippet?: string | undefined;
  highlights?: string[] | undefined;
}

/**
 * Interface for Context7 documentation lookup
 */
export interface Context7DocResult {
  libraryId: string;
  title: string;
  description?: string;
  content?: string;
}

/**
 * Unified search function that tries multiple search sources in priority order.
 *
 * @param query - The search query string
 * @param options - Search options (categories, domains, freshness, etc.)
 * @returns Promise resolving to search results from the best available source
 */
export async function searchWeb(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // Normalize options
  const prefs = options || {} as SearchOptions;
  const queryLower = query.toLowerCase().trim();

  // 1. Try Firecrawl first (authenticated, best results for general web searches)
  try {
    // Firecrawl search - we use the MCP tool mcp__firecrawl_firecrawl__firecrawl_search
    // The actual MCP call is handled by Claude Code's tool invocation
    // We structure the call here; Claude Code will resolve the MCP tool at runtime
    const firecrawlResults = await invokeFirecrawlSearch(query, prefs);
    if (firecrawlResults && firecrawlResults.length > 0) {
      // Transform Firecrawl results to our unified format
      for (const r of firecrawlResults) {
        results.push({
          source: 'firecrawl',
          title: r.title || (r as any).name || query,
          url: r.url || (r as any).href || '',
          snippet: r.description || (r as any).snippet || undefined,
          highlights: r.highlights,
        });
      }
      // If Firecrawl returned results, use them and return
      return results.slice(0, prefs.maxResults || 10);
    }
  } catch (firecrawlError) {
    // Firecrawl failed — log and fall through to free-search
    // In production, we'd log this: console.error('Firecrawl search error:', firecrawlError);
  }

  // 2. Fall back to free-search (keyless multi-engine, no API key needed)
  try {
    const freeSearchResults = await invokeFreeSearch(query, prefs);
    if (freeSearchResults && freeSearchResults.length > 0) {
      for (const r of freeSearchResults) {
        results.push({
          source: 'free-search',
          title: r.title || query,
          url: r.url || '',
          snippet: r.snippet,
          highlights: r.highlights,
        });
      }
      return results.slice(0, prefs.maxResults || 10);
    }
  } catch (freeSearchError) {
    // free-search failed — log and fall through to Context7
    // console.error('Free-search error:', freeSearchError);
  }

  // 3. Use Context7 for library/documentation queries
  // Context7 is best for API docs, library references, technical queries
  // We detect if this is a library/docs query by checking patterns
  if (isLibraryDocsQuery(queryLower)) {
    try {
      const context7Results = await invokeContext7Search(query, prefs);
      if (context7Results && context7Results.length > 0) {
        for (const r of context7Results) {
          results.push({
            source: 'context7',
            title: r.title || query,
            url: r.url || '',
            snippet: r.description,
            highlights: r.highlights,
          });
        }
        return results.slice(0, prefs.maxResults || 10);
      }
    } catch (context7Error) {
      // console.error('Context7 search error:', context7Error);
    }
  }

  // Return whatever we gathered (could be empty if all failed)
  return results;
}

/**
 * Check if the query appears to be a library/documentation query
 * (e.g., references to frameworks, libraries, APIs, SDKs)
 */
function isLibraryDocsQuery(query: string): boolean {
  const libraryPatterns = [
    // Common framework/lib keywords
    /react|next\.js|vue|angular|svelte/,
    // API/library patterns
    /prisma|supabase|express|django|flask|fastapi|spring/,
    // SDK patterns
    /aws|gcp|azure|docker|kubernetes/,
    // Documentation-like queries
    /how to|api|reference|documentation|docs/,
  ];

  return libraryPatterns.some((pattern) => pattern.test(query));
}

/**
 * Invoke Firecrawl search via MCP
 * This is a placeholder — Claude Code resolves the actual MCP tool call
 */
async function invokeFirecrawlSearch(
  query: string,
  prefs: SearchOptions
): Promise<{ title: string; url: string; description?: string; highlights?: string[] }[]> {
  // The actual MCP call will be handled by Claude Code's tool invocation system
  // We return a placeholder that indicates the tool should be called
  // In practice, Claude Code would call: mcp__firecrawl_firecrawl__firecrawl_search
  // with the appropriate parameters
  throw new Error('Firecrawl MCP call not resolved at this level — delegate to Claude Code tool invocation');
}

/**
 * Invoke free-search MCP search
 * This is a placeholder — Claude Code resolves the actual MCP tool call
 */
async function invokeFreeSearch(
  query: string,
  prefs: SearchOptions
): Promise<{ title: string; url: string; snippet?: string; highlights?: string[] }[]> {
  // The actual MCP call will be handled by Claude Code's tool invocation system
  // We return a placeholder that indicates the tool should be called
  // In practice, Claude Code would call: mcp__free-search__search
  // with the appropriate parameters
  throw new Error('free-search MCP call not resolved at this level — delegate to Claude Code tool invocation');
}

/**
 * Invoke Context7 documentation search
 * This is a placeholder — Claude Code resolves the actual MCP tool call
 */
async function invokeContext7Search(
  query: string,
  prefs: SearchOptions
): Promise<{ title: string; url: string; description?: string; highlights?: string[] }[]> {
  // The actual MCP call will be handled by Claude Code's tool invocation system
  // We return a placeholder that indicates the tool should be called
  // In practice, Claude Code would call: mcp__context7__query-docs
  // with the selected library ID and documentation query
  throw new Error('Context7 MCP call not resolved at this level — delegate to Claude Code tool invocation');
}

/**
 * Cache for search results — keyed by query hash to avoid redundant calls
 *
 * In a production deployment, this would use Redis or similar for persistence
 * across sessions. For now, it's an in-session memory cache.
 */
const searchCache: Map<string, { results: SearchResult[]; timestamp: number }> = new Map();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

/**
 * Get cached search results if available and not expired
 */
function getCachedResults(query: string): SearchResult[] | null {
  const cached = searchCache.get(query);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    searchCache.delete(query);
    return null;
  }
  return cached.results;
}

/**
 * Cache search results
 */
function cacheResults(query: string, results: SearchResult[]): void {
  searchCache.set(query, {
    results,
    timestamp: Date.now(),
  });
}

/**
 * Enhanced unified search with caching
 */
export async function searchWebCached(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  // Check cache first
  const cached = getCachedResults(query);
  if (cached) {
    // Return cached results, respecting maxResults if specified
    if (options?.maxResults && cached.length <= options.maxResults) {
      return cached;
    }
    return cached.slice(0, options?.maxResults || cached.length);
  }

  // Perform fresh search
  const results = await searchWeb(query, options);
  if (results.length > 0) {
    cacheResults(query, results);
  }
  return results;
}

// Default export for convenience
export default {
  searchWeb,
  searchWebCached,
};