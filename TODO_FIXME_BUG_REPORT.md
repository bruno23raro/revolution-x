# TODO, FIXME, BUG e Funções Não Implementadas — Revolution X Codebase

## Visão Geral
Esta análise cobre TODO, FIXME e marcadores de bug identificados nos diretórios solicitados:
- src/middleware/
- app/api/auth/
- app/api/integrations/
- src/lib/

## 1. TODO Comments

### src/
| Arquivo | Linha | Contexto |
|---------|-------|----------|
| `src/lib/testCenter.test.ts` | 27 | "todo href é rota interna (começa com /, sem esquema/hostname)" |
| `src/integrations/publicScraper.ts` | 32 | "Resolve um domínio para TODOS os endereços (v4 e/ou v6)" |
| `src/integrations/types.ts` | 88 | "Interface comum a TODOS os adaptadores de integração." |
| `src/integrations/openbsp/adapter.ts` | 935 | `// TODO(real): listar templates do WABA via Graph` |
| `src/integrations/meta/auth/oauth.ts` | 242 | `// TODO: Em produção, o redirectUri viria do request ou configuração,` |
| `src/integrations/meta/oauth-adapter.ts` | 45 | `// TODO: Implementar lógica de conexão OAuth completa quando habilitado` |
| `src/jobs/tiktokScheduler.ts` | 381 | "* Roda o cron do agendador para TODOS os tenants com intenção pendente" |
| `src/integrations/openbsp/adapter.ts` (defaultListTemplates) | 930-937 | Função que retorna `{ ok: false, ... }` como placeholder — não lista templates reais |

### app/
Nenhum TODO encontrado nos arquivos de API (app/api/).

### src/middleware/
Nenhum TODO encontrado nos arquivos de middleware.

### src/lib/
Nenhum TODO encontrado.

---

## 2. FIXME Comments
Nenhum comentário FIXME encontrado no codebase pesquisado.

---

## 3. BUG Markers
Nenhum marcador BUG explícito encontrado. Contudo, foram identificados problemas críticos de tratamento de erro e lógica:

### Problemas Críticos de Tratamento de Erro

#### 1. `app/api/auth/register/route.ts` — Rollback incompleto em falha
- **Linha 138-170**: Quando o onboarding falha, tenta deletar o usuário da GoTrue, mas:
  - Se o `rollback` falhar (linha 159), o código apenas faz `console.error` mas **continua retornando resposta 500** (linha 164-170)
  - **Risco**: Usuário fica com sessão GoTrue válida mas sem registro em `public.User` — "registro-zumbi" (documentado nas linhas 139-146)
  - **Solução**: O rollback deve ser garantido ou o erro deve ser tratado de forma diferente

#### 2. `app/api/integrations/disconnect/route.ts` — Revogação de token não falha a desconexão
- **Linha 86-89**: Erro na revogação do token Meta é apenas `console.warn` e a desconexão continua
- **Linha 88**: `// Não falhar a desconexão por erro de revogação` — mas isso pode deixar token vigente
- **Risco**: Token permanece ativo na Meta mesmo após desconexão do app

#### 3. `src/integrations/openbsp/adapter.ts` — `defaultListTemplates` placeholder
- **Linha 930-937**: Função retorna `{ ok: false, templates: [], errorDetail: 'list_templates_indisponivel' }`
- **Risco**: Sempre falha em listar templates; não tenta acesso real via Graph API

#### 4. `src/lib/sentry-api.ts` — Resposta genérica 500
- **Linha 20**: O wrapper `withSentry` sempre retorna `{ error: 'Internal Server Error' }` sem detalhes
- **Risco**: Informações úteis de erro são perdidas; difícil depurar em produção

---

## 4. Funções/Rotas Não Implementadas ou Incompletas

### `src/integrations/openbsp/adapter.ts` — `defaultListTemplates`
- **Status**: Função placeholder que nunca lista templates reais
- **Impacto**: Listagem de templates WhatsApp sempre falha em produção

### Problemas de Rotas API (reviewados)

#### `app/api/auth/login/route.ts`
- **Status**: Implementada, mas fallback catch-all (linha 54-58) sempre retorna `invalid_credentials` 401
- **Risco**: Qualquer erro inesperado é disfarçado como credenciais inválidas, dificultando debug

#### `app/api/auth/register/route.ts`
- **Status**: Completa, mas com lógica complexa de rollback (documentada)
- **Risco**: Falha no rollback pode criar "usuário zumbi" (see BUG #1 acima)

#### `app/api/integrations/disconnect/route.ts`
- **Status**: Implementada com revogação de token opcional
- **Risco**: Revogação silenciosa pode deixar credenciais vigentes (see BUG #2 acima)

#### `app/api/integrations/whatsapp-official/templates/route.ts`
- **Status**: GET e POST implementados
- **Risco**: POST requer canal conectado (linha 72-74), retorna 409 se não conectado — comportamento correto

---

## 5. Problemas Críticos de Segurança/Estabilidade Identificados

### 1. `src/middleware/rate-limit.ts` — Fallback Redis "fail open"
- **Linha 60-63**: Quando Redis indisponível, retorna `{ limited: false, ... }` (não bloqueia)
- **Risco**: Sem rate limiting em caso de falha Redis — possível abuso em produção
- **Sugestão**: Considerar circuito aberto mais rigoroso ou fallback para bloqueio temporário

### 2. `src/middleware/helmet.ts` — CSP permite 'unsafe-inline' e 'unsafe-eval'
- **Linha 24**: `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
- **Linha 25**: `style-src 'self' 'unsafe-inline'`
- **Risco**: Contém XSS via inline scripts/eval; considerar remover these para produção

### 3. `src/lib/auth.ts` — `getAuthenticatedUser` falha silenciosamente
- **Linha 45-56**: Se `supabase.auth.getUser()` falha, retorna `null` sem detalhes
- **Linha 70-78**: Erros de banco são logados mas retornam `null`
- **Impacto**: Rotas que exigem auth podem retornar 401 sem mensagem clara ao client

---

## Resumo Executivo

| Categoria | Qtd | Arquivos Afetados |
|-----------|-----|-------------------|
| TODO comments | 7 | src/integrations/ (5), src/tests/ (2) |
| Problemas de rollback | 1 | app/api/auth/register/route.ts |
| Problemas de revogação de token | 1 | app/api/integrations/disconnect/route.ts |
| Funções placeholder | 1 | src/integrations/openbsp/adapter.ts |
| Problemas de erro handler | 1 | src/lib/sentry-api.ts |
| Problemas de rate-limit | 1 | src/middleware/rate-limit.ts |
| Problemas de CSP | 1 | src/middleware/helmet.ts |

**Prioridades de correção:**
1. Corrigir rollback de falha no registro (BUG crítico — "usuário zumbi")
2. Tratar revogação de token Meta disconnect mais robustamente
3. Implementar `defaultListTemplates` real via Graph API
4. Melhorar mensagens de erro no catch-all de login/register
5. Considerar remover `unsafe-inline`/``unsafe-eval`` do CSP para produção