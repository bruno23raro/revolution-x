// ============================================================================
// MCP Server Custom para Vercel - Revolution X
// ============================================================================
// Este servidor MCP permite acesso programático ao Vercel com autenticação
// configurável via variáveis de ambiente.
//
// Uso:
// 1. Configure VERCEL_TOKEN no .env
// 2. Inicie com: node mcp-servers/vercel-custom-server.js
//
// Ferramentas disponíveis:
// - vercel_list_projects: Lista projetos
// - vercel_get_project: Detalhes de um projeto
// - vercel_list_deployments: Lista deployments
// - vercel_get_deployment: Detalhes de um deployment
// - vercel_create_deployment: Criar novo deployment
// - vercel_list_domains: Lista domínios de um projeto
// - vercel_get_project_logs: Logs de um projeto
// ============================================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Configuração
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const VERCEL_API_URL = 'https://api.vercel.com';

if (!VERCEL_TOKEN) {
  console.error('❌ Erro: VERCEL_TOKEN não configurado!');
  console.error('Configure a variável de ambiente VERCEL_TOKEN');
  process.exit(1);
}

const server = new Server(
  {
    name: 'vercel-custom',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper para chamadas à API do Vercel
async function vercelRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${VERCEL_API_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Vercel API Error: ${response.status} ${error.message || response.statusText}`);
  }

  return response.json();
}

// Lista de ferramentas disponíveis
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'vercel_list_projects',
        description: 'Lista todos os projetos Vercel',
        inputSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string', description: 'ID do time (opcional)' },
            limit: { type: 'integer', description: 'Limite de projetos', minimum: 1, maximum: 100, default: 30 },
          },
        },
      },
      {
        name: 'vercel_get_project',
        description: 'Obtém detalhes de um projeto específico',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'ID do projeto' },
            teamId: { type: 'string', description: 'ID do time (opcional)' },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'vercel_list_deployments',
        description: 'Lista deployments de um projeto',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'ID do projeto' },
            state: { type: 'string', enum: ['READY', 'BUILDING', 'ERROR', 'INITIALISING', 'DEPLOYING'], description: 'Filtrar por estado' },
            limit: { type: 'integer', description: 'Limite de deployments', minimum: 1, maximum: 100, default: 30 },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'vercel_get_deployment',
        description: 'Obtém detalhes de um deployment específico',
        inputSchema: {
          type: 'object',
          properties: {
            deploymentId: { type: 'string', description: 'ID do deployment' },
            teamId: { type: 'string', description: 'ID do time (opcional)' },
          },
          required: ['deploymentId'],
        },
      },
      {
        name: 'vercel_list_domains',
        description: 'Lista domínios de um projeto',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'ID do projeto' },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'vercel_add_domain',
        description: 'Adiciona um domínio a um projeto',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'ID do projeto' },
            domain: { type: 'string', description: 'Domínio a ser adicionado' },
          },
          required: ['projectId', 'domain'],
        },
      },
      {
        name: 'vercel_list_deployment_files',
        description: 'Lista arquivos de um deployment',
        inputSchema: {
          type: 'object',
          properties: {
            deploymentId: { type: 'string', description: 'ID do deployment' },
            limit: { type: 'integer', description: 'Limite de arquivos', minimum: 1, maximum: 100, default: 50 },
          },
          required: ['deploymentId'],
        },
      },
      {
        name: 'vercel_get_deployment_logs',
        description: 'Obtém logs de um deployment (limitado - requer Vercel CLI para logs completos)',
        inputSchema: {
          type: 'object',
          properties: {
            deploymentId: { type: 'string', description: 'ID do deployment' },
          },
          required: ['deploymentId'],
        },
      },
      {
        name: 'vercel_get_teams',
        description: 'Lista times disponíveis',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'vercel_list_environment_variables',
        description: 'Lista variáveis de ambiente de um projeto',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'ID do projeto' },
          },
          required: ['projectId'],
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
      case 'vercel_list_projects': {
        const data = await vercelRequest(`/v8/projects?limit=${args.limit || 30}${args.teamId ? `&teamId=${args.teamId}` : ''}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                data.projects.map((p) => ({
                  id: p.id,
                  name: p.name,
                  slug: p.slug,
                  url: p.url,
                  created: p.created,
                  updated: p.updated,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'vercel_get_project': {
        const project = await vercelRequest(`/v9/projects/${args.projectId}${args.teamId ? `?teamId=${args.teamId}` : ''}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                id: project.id,
                name: project.name,
                slug: project.slug,
                url: project.url,
                created: project.created,
                updated: project.updated,
                owner: project.owner?.email,
                team: project.team?.id,
                framework: project.framework,
                files: project.files,
                routes: project.routes,
                builds: project.builds,
              }, null, 2),
            },
          ],
        };
      }

      case 'vercel_list_deployments': {
        const params = new URLSearchParams({
          limit: (args.limit || 30).toString(),
        });
        if (args.state) params.append('state', args.state);
        const deployments = await vercelRequest(`/v13/deployments?projectId=${args.projectId}&${params}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                deployments.deployments?.map((d) => ({
                  id: d.uid,
                  name: d.name,
                  state: d.state,
                  url: d.url,
                  created: d.created,
                  updated: d.updated,
                  builder: d.builder?.name,
                })) || [],
                null,
                2
              ),
            },
          ],
        };
      }

      case 'vercel_get_deployment': {
        const deployment = await vercelRequest(`/v13/deployments/${args.deploymentId}${args.teamId ? `?teamId=${args.teamId}` : ''}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                id: deployment.uid,
                name: deployment.name,
                state: deployment.state,
                url: deployment.url,
                created: deployment.created,
                updated: deployment.updated,
                builder: deployment.builder?.name,
                routes: deployment.routes,
                meta: deployment.meta,
              }, null, 2),
            },
          ],
        };
      }

      case 'vercel_list_domains': {
        const domains = await vercelRequest(`/v9/projects/${args.projectId}/domains`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(domains.domains?.map((d) => ({
                name: d.name,
                type: d.type,
                verified: d.verified,
                created: d.created,
                expired: d.expired,
              })) || [],
              null,
              2
            ),
          ],
        };
      }

      case 'vercel_add_domain': {
        const result = await vercelRequest(`/v9/projects/${args.projectId}/domains`, {
          method: 'POST',
          body: JSON.stringify({ name: args.domain }),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                domain: result.domain?.name,
                verification_token: result.verification_token,
              }, null, 2),
            },
          ],
        };
      }

      case 'vercel_list_deployment_files': {
        const files = await vercelRequest(`/v13/deployments/${args.deploymentId}/files?limit=${args.limit || 50}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                files.files?.map((f) => ({
                  name: f.name,
                  path: f.path,
                  size: f.size,
                })) || [],
                null,
                2
              ),
            },
          ],
        };
      }

      case 'vercel_get_deployment_logs': {
        // Nota: Logs completo requer Vercel CLI
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Para logs completos de deployment, use: vercel logs',
                deploymentId: args.deploymentId,
                note: 'O Vercel CLI é necessário para logs completos',
              }, null, 2),
            },
          ],
        };
      }

      case 'vercel_get_teams': {
        const teams = await vercelRequest('/v5/teams');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                teams.teams?.map((t) => ({
                  id: t.id,
                  name: t.name,
                  slug: t.slug,
                  created: t.created,
                })) || [],
                null,
                2
              ),
            },
          ],
        };
      }

      case 'vercel_list_environment_variables': {
        const envs = await vercelRequest(`/v9/projects/${args.projectId}/env`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                envs.env?.map((e) => ({
                  key: e.key,
                  value: e.value ? '(oculto)' : '(vazio)',
                  target: e.target,
                  type: e.type,
                })) || [],
                null,
                2
              ),
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

console.error('MCP Server Vercel Custom iniciado com sucesso!');
console.error('Token configurado para usuário:', VERCEL_TOKEN ? 'sim' : 'não');