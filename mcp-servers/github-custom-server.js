// ============================================================================
// MCP Server Custom para GitHub - Revolution X
// ============================================================================
// Este servidor MCP permite acesso programático ao GitHub com autenticação
// configurável via variáveis de ambiente.
//
// Uso:
// 1. Configure GITHUB_TOKEN ou GITHUB_PAT no .env
// 2. Inicie com: node mcp-servers/github-custom-server.js
//
// Ferramentas disponíveis:
// - github_repo_status: Verifica status de um repo
// - github_list_branches: Lista branches
// - github_get_prs: Get PRs
// - github_create_issue: Create issue
// - github_search: Search in repo
// ============================================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Configuração
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '';
const GITHUB_API_URL = 'https://api.github.com';

if (!GITHUB_TOKEN) {
  console.error('❌ Erro: GITHUB_TOKEN não configurado!');
  console.error('Configure a variável de ambiente GITHUB_TOKEN ou GITHUB_PAT');
  process.exit(1);
}

const server = new Server(
  {
    name: 'github-custom',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper para chamadas à API do GitHub
async function githubRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${GITHUB_API_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Revolution-X-MCP/1.0',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Lista de ferramentas disponíveis
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'github_repo_status',
        description: 'Verifica o status de um repositório GitHub (issues, PRs, stars, forks)',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Proprietário do repositório' },
            repo: { type: 'string', description: 'Nome do repositório' },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'github_create_issue',
        description: 'Cria uma nova issue em um repositório',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Proprietário do repositório' },
            repo: { type: 'string', description: 'Nome do repositório' },
            title: { type: 'string', description: 'Título da issue', minLength: 1, maxLength: 200 },
            body: { type: 'string', description: 'Descrição da issue', maxLength: 10000 },
            labels: { type: 'array', items: { type: 'string' }, description: 'Labels da issue' },
          },
          required: ['owner', 'repo', 'title'],
        },
      },
      {
        name: 'github_list_branches',
        description: 'Lista branches de um repositório',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Proprietário do repositório' },
            repo: { type: 'string', description: 'Nome do repositório' },
            limit: { type: 'integer', description: 'Limite de branches', minimum: 1, maximum: 100, default: 30 },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'github_list_pull_requests',
        description: 'Lista pull requests abertos de um repositório',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Proprietário do repositório' },
            repo: { type: 'string', description: 'Nome do repositório' },
            state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Estado dos PRs', default: 'open' },
            limit: { type: 'integer', description: 'Limite de PRs', minimum: 1, maximum: 100, default: 30 },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'github_get_pr_details',
        description: 'Obtém detalhes de um pull request específico',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Proprietário do repositório' },
            repo: { type: 'string', description: 'Nome do repositório' },
            prNumber: { type: 'integer', description: 'Número do PR', minimum: 1 },
          },
          required: ['owner', 'repo', 'prNumber'],
        },
      },
      {
        name: 'github_list_issues',
        description: 'Lista issues de um repositório',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Proprietário do repositório' },
            repo: { type: 'string', description: 'Nome do repositório' },
            state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Estado das issues', default: 'open' },
            labels: { type: 'array', items: { type: 'string' }, description: 'Filtrar por labels' },
            limit: { type: 'integer', description: 'Limite de issues', minimum: 1, maximum: 100, default: 30 },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'github_search_commits',
        description: 'Pesquisa commits em um repositório',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Proprietário do repositório' },
            repo: { type: 'string', description: 'Nome do repositório' },
            query: { type: 'string', description: 'Termo de busca', minLength: 1 },
          },
          required: ['owner', 'repo', 'query'],
        },
      },
      {
        name: 'github_create_branch',
        description: 'Cria um novo branch a partir de uma referência específica',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Proprietário do repositório' },
            repo: { type: 'string', description: 'Nome do repositório' },
            newBranch: { type: 'string', description: 'Nome do novo branch', minLength: 1 },
            baseBranch: { type: 'string', description: 'Branch base para criar a partir', default: 'main' },
          },
          required: ['owner', 'repo', 'newBranch'],
        },
      },
      {
        name: 'github_get_user_info',
        description: 'Obtém informações do usuário autenticado',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handler para chamadas de ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'github_repo_status': {
        const data = await githubRequest(`/repos/${args.owner}/${args.repo}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                name: data.full_name,
                description: data.description,
                stars: data.stargazers_count,
                forks: data.forks_count,
                issues: data.open_issues_count,
                watchers: data.watchers_count,
                language: data.language,
                default_branch: data.default_branch,
                created_at: data.created_at,
                updated_at: data.updated_at,
                pushed_at: data.pushed_at,
                license: data.license?.name,
                visibility: data.visibility,
              }, null, 2),
            },
          ],
        };
      }

      case 'github_create_issue': {
        const data = await githubRequest(`/repos/${args.owner}/${args.repo}/issues`, {
          method: 'POST',
          body: JSON.stringify({
            title: args.title,
            body: args.body,
            labels: args.labels,
          }),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                issue_number: data.number,
                title: data.title,
                url: data.html_url,
                state: data.state,
              }, null, 2),
            },
          ],
        };
      }

      case 'github_list_branches': {
        const branches = await githubRequest(
          `/repos/${args.owner}/${args.repo}/branches?per_page=${args.limit || 30}`
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                branches.map((b) => ({
                  name: b.name,
                  commit_sha: b.commit.sha,
                  protected: b.protected,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'github_list_pull_requests': {
        const prs = await githubRequest(
          `/repos/${args.owner}/${args.repo}/pulls?state=${args.state || 'open'}&per_page=${args.limit || 30}`
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                prs.map((pr) => ({
                  number: pr.number,
                  title: pr.title,
                  state: pr.state,
                  user: pr.user.login,
                  created_at: pr.created_at,
                  updated_at: pr.updated_at,
                  merged: pr.merged,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'github_get_pr_details': {
        const pr = await githubRequest(`/repos/${args.owner}/${args.repo}/pulls/${args.prNumber}`);
        const commits = await githubRequest(`/repos/${args.owner}/${args.repo}/pulls/${args.prNumber}/commits`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                number: pr.number,
                title: pr.title,
                body: pr.body,
                state: pr.state,
                merged: pr.merged,
                user: pr.user.login,
                comments: pr.comments,
                commits: commits.length,
                files_changed: pr.changed_files,
                additions: pr.additions,
                deletions: pr.deletions,
                head_branch: pr.head.branch,
                base_branch: pr.base.ref,
                created_at: pr.created_at,
                merged_at: pr.merged_at,
                url: pr.html_url,
              }, null, 2),
            },
          ],
        };
      }

      case 'github_list_issues': {
        const params = new URLSearchParams({
          state: args.state || 'open',
          per_page: (args.limit || 30).toString(),
        });
        if (args.labels && args.labels.length > 0) {
          params.append('labels', args.labels.join(','));
        }
        const issues = await githubRequest(`/repos/${args.owner}/${args.repo}/issues?${params}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                issues.map((issue) => ({
                  number: issue.number,
                  title: issue.title,
                  state: issue.state,
                  user: issue.user.login,
                  labels: issue.labels.map((l) => l.name),
                  comments: issue.comments,
                  created_at: issue.created_at,
                  updated_at: issue.updated_at,
                  url: issue.html_url,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'github_search_commits': {
        const commits = await githubRequest(
          `/search/commits?q=repo:${args.owner}/${args.repo}+${encodeURIComponent(args.query)}&per_page=30`
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                commits.items.map((c) => ({
                  sha: c.sha,
                  message: c.commit.message.split('\n')[0],
                  author: c.author?.login,
                  date: c.commit.author.date,
                  url: c.html_url,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'github_create_branch': {
        // Primeiro, obter o SHA do branch base
        const baseBranch = args.baseBranch || 'main';
        const ref = await githubRequest(`/repos/${args.owner}/${args.repo}/git/ref/heads/${baseBranch}`);

        // Criar novo branch
        const branch = await githubRequest(`/repos/${args.owner}/${args.repo}/git/refs`, {
          method: 'POST',
          body: JSON.stringify({
            ref: `refs/heads/${args.newBranch}`,
            sha: ref.object.sha,
          }),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ref: branch.ref,
                url: `https://github.com/${args.owner}/${args.repo}/tree/${args.newBranch}`,
              }, null, 2),
            },
          ],
        };
      }

      case 'github_get_user_info': {
        const user = await githubRequest('/user');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                login: user.login,
                id: user.id,
                name: user.name,
                email: user.email,
                avatar_url: user.avatar_url,
                bio: user.bio,
                company: user.company,
                blog: user.blog,
                location: user.location,
                public_repos: user.public_repos,
                followers: user.followers,
                following: user.following,
                created_at: user.created_at,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Ferramenta não implementada: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          }, null, 2),
        },
      ],
    };
  }
});

// Iniciar servidor
const transport = new StdioServerTransport();
server.connect(transport);

console.error('MCP Server GitHub Custom iniciado com sucesso!');
console.error('Token configurado para usuário:', process.env.GITHUB_TOKEN ? 'sim' : 'não');