# Modo Demo - Revolution X

## Visão Geral

O **Modo Demo** permite testar a plataforma sem necessidade de login real.
Ideal para demonstrações, testes de desenvolvimento e onboarding de membros
da equipe.

## Ativação

O modo demo só pode ser ativado quando ambas as condições são verdadeiras:

1. `NODE_ENV !== 'production'` (desenvolvimento ou teste)
2. `RX_DEMO_MODE === '1'`

### Como ativar localmente:

```bash
# Desenvolvimento com demo mode
npm run dev:demo

# Ou manualmente:
RX_DEMO_MODE=1 NODE_ENV=development npm run dev
```

## Segurança CRÍTICA

⚠️ **O modo demo é BLOQUEADO em produção, independentemente da configuração.**

- Mesmo que `RX_DEMO_MODE=1` esteja definido em produção, `demoModeEnabled()`
  retorna `false` automaticamente.
- O seed de demo rejeita conexões com o banco de produção.
- Tokens demo são criados com assinatura fictícia, não usando chaves reais.

## Fluxo de Autenticação Demo

1. **Login**: Usuário acessa `/dev` e clica em "Entrar no Modo Demo"
2. **API**: `POST /api/dev/demo-login` cria tokens JWT mock
3. **Cookies**: São configurados `sb:token`, `sb-refresh-token` e `x-organization-id`
4. **Middleware**: Detecta token demo via `isDemoToken()` e injeta usuário demo

## Identidades Demo

| Campo | Valor |
|-------|-------|
| User ID | `00000000-0000-0000-0000-000000000001` |
| Email | `demo@revolutionx.dev` |
| Organization ID | `00000000-0000-0000-0000-000000000002` |
| Role | `admin` |

## Dados Seed

O seed de demo (`/prisma/seed-demo.ts`) cria os seguintes dados fictícios:

- 1 Organização (Demo Org)
- 1 Usuário administrador
- 1 Pipeline CRM
- 2 Contatos
- 1 Lead (status: hot, score: 85)
- 1 Deal (R$ 15.000)
- 1 Campanha
- 2 Mensagens WhatsApp simuladas
- 2 Posts simulados (Instagram/Facebook)
- 1 Memória de assistente IA

## Execução do Seed

```bash
# Ativar demo mode e rodar seed
RX_DEMO_MODE=1 npm run db:seed:demo
```

## Integrações Mocks

No modo demo, as integrações retornam dados simulados:

| Integração | Tipo de Mock |
|------------|--------------|
| OpenBSP WhatsApp | Resposta 200 com `provider: 'demo'` |
| Instagram Publish | Post simulado com `status: 'published'` |
| Facebook Publish | Post simulado com `status: 'published'` |
| AI Generate | Mensagem aleatória de boas-vindas |

## Arquivos Relevantes

- `src/lib/demoMode.ts` - Funções de detecção e validação
- `app/api/dev/demo-login/route.ts` - Endpoint de login demo
- `prisma/seed-demo.ts` - Seed de dados fictícios
- `src/lib/auth.ts` - Integração com `getAuthenticatedUser()`
- `src/middleware/demo-auth.ts` - Helper de autenticação demo

## Debug

Verifique se o modo demo está funcionando:

```bash
# Ver se demoModeEnabled está retornando true
NODE_ENV=development RX_DEMO_MODE=1 npx tsx -e "
import { demoModeEnabled } from './src/lib/demoMode';
console.log('Demo enabled:', demoModeEnabled());
"
```