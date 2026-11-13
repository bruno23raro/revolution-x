# MCP Servers Custom - Revolution X

Este diretório contém servidores MCP customizados para autenticação e gerenciamento dos serviços principais do projeto Revolution X.

## 🚀 MCPs Disponíveis

### 1. GitHub MCP Custom (`github-custom-server.js`)

Servidor MCP customizado para acesso programático ao GitHub com ferramentas estendidas.

#### Ferramentas Disponíveis

| Ferramenta | Descrição |
|------------|-----------|
| `github_repo_status` | Verifica status de um repositório (issues, PRs, stars, forks) |
| `github_create_issue` | Cria uma nova issue em um repositório |
| `github_list_branches` | Lista branches de um repositório |
| `github_list_pull_requests` | Lista pull requests abertos |
| `github_get_pr_details` | Obtém detalhes de um PR específico |
| `github_list_issues` | Lista issues de um repositório |
| `github_search_commits` | Pesquisa commits em um repositório |
| `github_create_branch` | Cria um novo branch a partir de uma referência |
| `github_get_user_info` | Obtém informações do usuário autenticado |

#### Configuração

```bash
# Token de autenticação
export GITHUB_TOKEN=seu_token_aqui
# ou GITHUB_PAT (alias)
```

#### Exemplo de Uso

```javascript
// Listar projetos
await mcp.call('github_list_repos', { owner: 'bruno23raro' });

// Criar issue
await mcp.call('github_create_issue', {
  owner: 'bruno23raro',
  repo: 'revolution-x',
  title: 'Bug no webhook Meta',
  body: 'Descrição detalhada do problema...',
  labels: ['bug', 'priority:high']
});
```

---

### 2. Vercel MCP Custom (`vercel-custom-server.js`)

Servidor MCP customizado para gerenciamento de projetos e deployments no Vercel.

#### Ferramentas Disponíveis

| Ferramenta | Descrição |
|------------|-----------|
| `vercel_list_projects` | Lista todos os projetos Vercel |
| `vercel_get_project` | Obtém detalhes de um projeto específico |
| `vercel_list_deployments` | Lista deployments de um projeto |
| `vercel_get_deployment` | Obtém detalhes de um deployment |
| `vercel_list_domains` | Lista domínios de um projeto |
| `vercel_add_domain` | Adiciona um domínio a um projeto |
| `vercel_list_deployment_files` | Lista arquivos de um deployment |
| `vercel_get_deployment_logs` | Obtém logs de um deployment |
| `vercel_get_teams` | Lista times disponíveis |
| `vercel_list_environment_variables` | Lista variáveis de ambiente de um projeto |

#### Configuração

```bash
# Token de autenticação
export VERCEL_TOKEN=seu_token_aqui
```

#### Exemplo de Uso

```javascript
// Listar projetos
await mcp.call('vercel_list_projects', {});

// Obter detalhes do projeto
await mcp.call('vercel_get_project', { projectId: 'your-project-id' });

// Listar deployments
await mcp.call('vercel_list_deployments', { projectId: 'your-project-id' });

// Adicionar domínio
await mcp.call('vercel_add_domain', {
  projectId: 'your-project-id',
  domain: 'novo.dominio.com'
});
```

---

## 🔧 Configuração de MCP.json

Adicionei ambos os servidores ao seu `.mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "seu_token"
      }
    },
    "github-custom": {
      "command": "cmd",
      "args": ["/c", "node", "mcp-servers\\github-custom-server.js"],
      "env": {
        "GITHUB_TOKEN": "seu_token"
      }
    },
    "vercel-custom": {
      "command": "cmd",
      "args": ["/c", "node", "mcp-servers\\vercel-custom-server.js"],
      "env": {
        "VERCEL_TOKEN": "seu_token"
      }
    }
  }
}
```

## 📋 Passos para Autenticação

### GitHub
1. Acesse: https://github.com/settings/tokens
2. Clique em "Generate new token"
3. Selecione as permissões necessárias:
   - `repo` (Full control of private repositories)
   - `read:user` (Read user data)
   - `workflow` (Update workflow actions)
4. Copie o token e cole no `.mcp.json`

### Vercel
1. Acesse: https://vercel.com/account/tokens
2. Clique em "Create token"
3. Dê um nome e copie o token
4. Adicione ao `.mcp.json`

## 🚀 Inicialização

Para reiniciar os MCPs após alterações:

```bash
# Via CLI
claude mcp restart github-custom
claude mcp restart vercel-custom

# Ou reinicie o Claude Code
```

## 🛠️ Desenvolvimento

```bash
# Executar servidores manualmente
node mcp-servers/github-custom-server.js
node mcp-servers/vercel-custom-server.js

# Testar endpoints
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user
```

## 📝 Notas de Segurança

- 🔒 **NUNCA** commite tokens reais no repositório
- ✅ Tokens devem ser rotacionados periodicamente
- 🛡️ Considere usar variáveis de ambiente com `.env` gitignore
- 🔐 O servidor detecta ausência de token e sai com erro claro

## 📚 Recursos Adicionais

- [MCP Documentation](https://github.com/modelcontextprotocol/docs)
- [GitHub API Docs](https://docs.github.com/en/rest)
- [Vercel API Docs](https://vercel.com/docs/rest-api)