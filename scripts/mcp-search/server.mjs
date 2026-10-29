// MCP de pesquisa local via SearXNG (sem chave de API).
// Registra em CC: claude mcp add search -- node "C:\Users\Bruno\.claude\Revolution\X\scripts\mcp-search\server.mjs"
// shortcut: usa SEARXNG_URL local; se sair do ar, a tool devolve erro honesto (sem fallback pago).
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const BASE = process.env.SEARXNG_URL || 'http://localhost:8888';

async function searchWeb({ query, categories, engines, language = 'pt-BR', safesearch = 1, pages = 1 }) {
  const lines = [];
  const answers = [];
  for (let p = 1; p <= pages; p++) {
    const u = new URL(BASE + '/search');
    u.searchParams.set('q', String(query));
    u.searchParams.set('format', 'json');
    u.searchParams.set('language', language);
    u.searchParams.set('safesearch', String(safesearch));
    if (categories) u.searchParams.set('categories', categories);
    if (engines) u.searchParams.set('engines', engines);
    if (p > 1) u.searchParams.set('pageno', String(p));
    const res = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`SearXNG HTTP ${res.status}`);
    const j = await res.json();
    for (const r of (j.results || []).slice(0, 10)) {
      lines.push(`- ${r.title}\n  ${r.url}\n  ${(r.content || '').slice(0, 220)}`);
    }
    const infobox = j.infoboxes?.[0];
    if (infobox?.infobox) lines.push(`- [infobox] ${infobox.infobox} — ${infobox.content || ''}`.slice(0, 400));
    answers.push(...(j.answers || []));
  }
  return lines.join('\n') + (answers.length ? '\n\nAnswers:\n' + answers.slice(0, 2).map((a) => `- ${a}`).join('\n') : '') || 'Sem resultados.';
}

const server = new Server(
  { name: 'rx-search', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'web_search',
      description: 'Busca na web via SearXNG local (agrega Google/Bing/DuckDuckGo/Wikipedia). Retorna títulos, URLs e trechos.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          categories: { type: 'string', description: 'ex.: general, news, it, science' },
          engines: { type: 'string', description: 'ex.: google,bing,duckduckgo,wikipedia' },
          language: { type: 'string', default: 'pt-BR' },
          safesearch: { type: 'integer', enum: [0, 1, 2], default: 1 },
          pages: { type: 'integer', minimum: 1, maximum: 3, default: 1 },
        },
        required: ['query'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== 'web_search') return { content: [{ type: 'text', text: `tool desconhecida: ${req.params.name}` }] };
  try {
    const text = await searchWeb(req.params.arguments || {});
    return { content: [{ type: 'text', text }] };
  } catch (e) {
    return { content: [{ type: 'text', text: `ERRO busca (${BASE}): ${e.message}` }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
