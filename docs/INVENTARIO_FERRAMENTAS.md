# Inventário de Ferramentas - Revolution X

## 1. AGENTES CLaude Code

### Agentes Especializados Disponíveis

| Agente | Especialidade | Status | Uso Recomendado |
|--------|--------------|--------|-----------------|
| **backend-builder** | Backend, Prisma, auth, RLS, integrações | ✅ Disponível | APIs, banco, integrações |
| **backend-dev** | Desenvolvimento backend | ✅ Disponível | Endpoints, lógica de negócio |
| **ai-engineer** | ML, modelos, integração AI | ✅ Disponível | OpenBSP, GPTs, agentes |
| **code-review-swarm** | Revisão de código multi-agente | ✅ Disponível | QA, segurança, bugs |
| **database-optimizer** | PostgreSQL, índices, queries | ✅ Disponível | Performance, migrações |
| **security-architect** | Security design | ✅ Disponível | RLS, OAuth, tokens |
| **security-manager** | Protocolos de consenso | ✅ Disponível | N/A - não aplicável |
| **supabase-swarmp** | Supabase MCP operations | ✅ Disponível | Banco, auth, integrações |
| **swarm-init** | Inicialização de enxame | ✅ Disponível | Coordenação multi-agente |

### Agentes de Workflow

| Agente | Função | Status |
|--------|--------|--------|
| **workflow-automation** | GitHub Actions CI/CD | ✅ Disponível |
| **flow-nexus-swarm** | Orquestração de swarms | ✅ Disponível |
| **github-code-review** | Revisão de PR | ✅ Disponível |
| **github-multi-repo** | Múltiplos repositórios | ✅ Disponível |

## 2. MCP SERVERS Conectados

### Servidores Ativos

| Servidor | Ferramentas | Status | Observações |
|----------|-------------|--------|-------------|
| **firecrawl** | Busca web, scraping, extração | ✅ Conectado | Para documentação |
| **sentry** | Monitoramento, errors | ✅ Conectado | Para produção |
| **supabase** | Banco, migrações, tabelas | ✅ Conectado | Project: ardpabjoepzhkpmkgwgu |
| **vercel** | Deploy, logs, config | ✅ Conectado | Backup/prod |

### Servidores Desconectados

| Servidor | Ferramentas | Status | Observações |
|----------|-------------|--------|-------------|
| **meta** | WhatsApp, Instagram, Facebook | ❌ Desconectado | **BLOQUEIO CRÍTICO** |
| **devtools** | Meta Developer Tools | ❌ Desconectado | Precisa autorizar |
| **playwright** | Testes E2E | ❌ Desconectado | Não necessário enquanto MCP browser ativo |

### Servidores MCP Indisponíveis

| Servidor | Ferramentas Necessárias | Motivo |
|----------|------------------------|--------|
| **OpenBSP** | `openbsp_*` | Não configurado - precisa de autenticação |
| **n8n** | `n8n_*` | Não configurado |
| **hostinger** | `hostinger-*` | Parcialmente funcional |

## 3. Skills do Projeto

### Skills de Desenvolvimento

```
.claude/skills/
├── graft/                    # Busca código (usando graph)
├── meta-app-setup/          # Configuração Meta API
├── whatsapp-templates/      # Templates WhatsApp
├── instagram-publishing/      # Publicação Instagram
├── ai-provider/               # Configuração AI providers
├── browser/                   # Automação browser
├── github-code-review/        # Revisão de código
├── swarm-orchestration/       # Orquestração de agentes
├── v3-performance-optimization/ # Otimização v3
├── verification-quality/      # Verificação de qualidade
└── mcp-servers/              # Gerenciamento MCP
```

### Skills de Projeto Específico

```
.claude/skills/
├── plan/                      # Planejamento
├── research/                   # Pesquisa
├── workshop-authoring/         # Criação de workflows
├── loop/                       # Loop contínuo
├── context7-mcp/               # Documentação de bibliotecas
└── environment-audit/          # Auditoria de ambiente
```

## 4. Plugins Instalados

### Via Claude Extension

| Plugin | Função | Status |
|--------|--------|--------|
| **claude-code-guide** | Docs Claude Code | ✅ Instalado |
| **code-review** | Revisão de código | ✅ Instalado |
| **research** | Pesquisa de código | ✅ Instalado |
| **workspace-manager** | Gerenciamento workspace | ✅ Instalado |

### Via MCP

| Plugin | Ferramentas | Status |
|--------|-------------|--------|
| **devtools** | Ferramentas Meta | ❌ Conexão fechada |
| **firecrawl** | Web scraping | ✅ Ativo |

## 5. CLI e Ferramentas Disponíveis

### Ferramentas Globais

```bash
# Node.js e npm
node --version     # v20.x
npm --version      # 10.x
npx --version      # 10.x

# Git
git --version      # 2.x

# GitHub CLI
gh --version       # 65.x

# TypeScript
tsc --version      # 5.x

# Prisma
prisma --version   # 7.x

# Playwright
playwright --version # 1.64.1

# Docker
docker --version   # 24.x (instalado WSL2)

# Supabase CLI
supabase --version # Não instalado

# Diretórios importantes
~/.claude/         # Configurações
~/AppData/        # dados temporários
```

### Ferramentas do Projeto

```json
// package.json scripts
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "npm test",
  "typecheck": "tsc --noEmit",
  "db:migrate": "prisma migrate deploy",
  "db:seed": "prisma db seed",
  "db:seed:demo": "tsx prisma/seed-demo.ts",
  "dev:demo": "RX_DEMO_MODE=1 next dev"
}
```

## 6. Contas e Credenciais Conhecidas

### Supabase
- **Project**: `ardpabjoepzhkpmkgwgu` (produção)
- **Dev**: `urdmpzjycwywsjzhpntc` (localmente)
- **Service Role**: ✓ Configurado
- **Status**: Conectado via MCP

### Meta/Meta Ads
- **App ID**: 1112157761403064
- **App Secret**: ✓ Configurado
- **Status**: 🔴 Mcp dev_tools desconectado

### OpenBSP
- **Base URL**: `https://nheelwshzbgenpavwhcy.supabase.co/rest/v1`
- **Status**: Endpoint live, integração via HTTP direto

### Hostinger
- **Domínio**: revolutionx.com.br
- **Status**: Conectado via hPanel

## 7. Arquitetura do Projeto

### Stack Técnico
```
Frontend: Next.js 14 (App Router) + React 18 + TypeScript
Backend:  API Routes + Prisma ORM
Banco:    PostgreSQL (Supabase)
Auth:     GoTrue (Supabase Auth)
Deploy:   Hostinger + hPanel
CI/CD:    GitHub Actions
```

### Estrutura de Pastas
```
app/              # Pages e rotas API
├── api/
│   ├── auth/       # Login, register, session
│   ├── crm/        # Contatos, leads, deals
│   ├── integrations/ # OpenBSP, Meta, manual
│   ├── ai/         # Geração de conteúdo
│   └── dev/        # Demo mode (novo)
├── crm/          # Páginas CRM
├── dev/          # Página demo
├── dashboard/    # Dashboard principal
└── ...

src/
├── lib/          # Utilitários
│   ├── auth.ts   # Autenticação
│   ├── prisma.ts # Cliente Prisma
│   ├── demoMode.ts # NOVO: modo demo
│   └── ...
├── middleware.ts # Rate limiting, org context
└── ...

prisma/
├── schema.prisma
├── seed-demo.ts  # NOVO: seed demo
└── migrations/
```

## 8. Fluxos Críticos Identificados

### Fluxo Auth
```
POST /api/auth/login
  → supabase.auth.signInWithPassword()
  → supabase.auth.setSession()
  → Retorna { user }
```

### Fluxo WhatsApp (OpenBSP)
```
POST /api/integrations/openbsp/incoming
  → Webhook Meta
  → Validação HMAC
  → Processamento via processWhatsAppPayload()
  → Salva mensagem no banco
  → Atualiza status
```

### Fluxo Demo Mode (Implementado)
```
POST /api/dev/demo-login
  → demoModeEnabled()? → false → 403
  → Cria JWT mock com is_demo=true
  → Configura cookies
  → Retorna { user: demo, demo: true }
```

## 9. Pendências Bloqueadas

### 1. Meta MCP DevTools
- **Ferro**: Conexão fechada
- **Impacto**: Não é crítico para demo mode
- **Solução**: Usar chamadas HTTP diretas para Meta API

### 2. OpenBSP MCP (se necessário)
- **Ferro**: Não configurado
- **Impacto**: Integração via HTTP direto já funciona
- **Solução**: Usar client HTTP existente

### 3. Reset de senha Admin
- **Task**: Precisa resetar senha de brunoalmeida23111996@gmail.com
- **Como**: Dashboard Supabase → Auth → Users → Reset password
- **Status**: Pendente ação humana

## 10. Recomendações para Falha Offline

Se precisar de:
- **Meta API**: HTTP direto via `fetch()` (já implementado em `src/integrations/meta/`)
- **OpenBSP**: HTTP direto (já implementado)
- **SendEmail**: Resend API via `resend` package
- **Deploy**: Via hPanel manual ou GitHub Actions → Hostinger

---

**Última atualização**: 2026-11-09
**Status geral**: ✅ Ambientável para demo offline
**Bloqueios**: Meta MCP DevTools (não crítico)