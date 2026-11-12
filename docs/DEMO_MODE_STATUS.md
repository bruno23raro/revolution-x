# Status do Modo Demo - 2026-11-09

## Resumo

✅ **Compromisso cumprido**: Criar ambiente local de demonstração sem login real.

## Implementações Concluídas

### 1. Core do Demo Mode
- **Arquivo**: `src/lib/demoMode.ts`
- **Funções**:
  - `demoModeEnabled()` - Verifica se modo demo está ativo (sempre false em produção)
  - `isDemoToken(token)` - Detecta token demo JWT
  - `decodeDemoToken(token)` - Decodifica claims do token demo
  - `DEMO_IDENTITIES` - Constantes com IDs fictícios

### 2. API de Login Demo
- **Arquivo**: `app/api/dev/demo-login/route.ts`
- **Funcionalidades**:
  - POST cria sessão demo com JWT mock
  - Configura cookies `sb:token`, `sb-refresh-token`, `x-organization-id`
  - Retorna 403 quando demo mode desativado

### 3. Integração com Auth
- **Modificado**: `src/lib/auth.ts`
- **Alteração**: `getAuthenticatedUser()` detecta sessão demo via `isDemoToken()`

### 4. Seed Demo
- **Arquivo**: `prisma/seed-demo.ts`
- **Dados criados**:
  - 1 Organização demo
  - 1 Usuário admin demo
  - CRM (contatos, leads, deals)
  - 1 Campanha
  - Mensagens WhatsApp simuladas
  - Posts Instagram/Facebook simulados
  - Memória de assistente IA

### 5. Página Dev
- **Arquivos**: `app/dev/page.tsx`, `app/dev/layout.tsx`
- **UI**: Botão "Entrar no Modo Demo" (funciona apenas quando demo está habilitado)

### 6. Testes
- **Arquivos**: 
  - `app/api/dev/demo-login/route.test.ts`
  - `src/tests/demo-mode.test.ts`
- **Cobertura**:
  - Segurança (403 quando demo desativado)
  - Fluxo de login demo
  - Cookies de sessão
  - Funcões de token demo

### 7. Scripts NPM
```json
{
  "db:seed:demo": "TSX_REVISION=tsx npx tsx prisma/seed-demo.ts",
  "dev:demo": "cross-env RX_DEMO_MODE=1 NODE_ENV=development next dev"
}
```

### 8. Documentação
- **Arquivo**: `docs/DEMO_MODE.md`
- `.env.example` atualizado com documentação

## Segurança Garantida

| Verificação | Status |
|-------------|--------|
| NODE_ENV === 'production' bloqueia demo | ✅ |
| Seed rejeita produção (ardpabjoepzhkpmkgwgu) | ✅ |
| Tokens demo têm assinatura fictícia | ✅ |
| Nenhuma conexão com Supabase prod em demo | ✅ |

## Próximos Passos (pendentes)

### Integrações a mockar (quando necessário)

1. **WhatsApp OpenBSP** (`src/integrations/openbsp/client.ts`)
   - Short-circuit demo em `send()`

2. **Instagram/Facebook Publish**
   - Mockar em ambientes demo

3. **AI Generate**
   - Resposta simulada quando demo

### Passos humanos necessários

1. Reset de senha admin (se preciso): Dashboard Supabase → Auth → Users → Reset password

## Como Usar

### Ativar modo demo local:

```bash
# Start development with demo mode
npm run dev:demo

# Ou manualmente
RX_DEMO_MODE=1 npm run dev
```

### Seed de dados demo:

```bash
# Seed contra banco local
RX_DEMO_MODE=1 npm run db:seed:demo
```

### Entrar no modo demo:

1. Acesse http://localhost:3000/dev
2. Clique em "Entrar no Modo Demo"
3. Redirecionado para dashboard com dados fictícios

## Arquivos Criados

```
app/api/dev/demo-login/route.ts
app/api/dev/demo-login/route.test.ts
app/dev/page.tsx
app/dev/layout.tsx
prisma/seed-demo.ts
src/tests/demo-mode.test.ts
src/middleware/demo-auth.ts
docs/DEMO_MODE.md
docs/DEMO_MODE_STATUS.md
.env.example
```

## Arquivos Modificados

```
src/lib/demoMode.ts (extendido)
src/lib/auth.ts (detecção sessão demo)
package.json (novos scripts)
PLAN_LOCAL_DEMO_OPENBSP.md (atualizado)
```

## Testes

```bash
# Testes de demo mode
npm test -- --testPathPattern="demo"

# Verificar TypeScript
npx tsc --noEmit
```

## Evidências

- 0 erros TypeScript
- Testes de demo mode: PASS
- Seed demo: idempotent (usa upsert)