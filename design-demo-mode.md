# Design — Modo Demo Sem Login (Revolution X)

## 1. Visão Geral

Este design define um modo "local demo" acessível sem login em `http://localhost:3000/dev`, contendo dados fictícios que simulam:
- CRM (contatos/leads/deals/pipelines)
- Campanhas e disparos
- WhatsApp SIMULADO (sem conexão real com OpenBSP)
- Instagram/Facebook SIMULADOS
- IA (assistente/geração)
- Relatórios

### Restrições Críticas

1. **Impossível em produção**: Quando `NODE_ENV === 'production'`, o caminho demo deve ser recusado **mesmo se** `RX_DEMO_MODE=1` estiver configurado. A guarda é server-side apenas (nenhum `NEXT_PUBLIC_`).
2. **Modo de produção inalterado**: Login, autorização e multi-tenancy normais continuam funcionando unchanged. O modo demo é um *bypass* apenas em dev local.
3. **Isolamento de dados**: O modo demo roda contra o Supabase local (Docker `supabase-docker`, Postgres :54321/:15432) via `.env.local`. O banco de produção nunca é tocado.

---

## 2. Demo Flag + Guard

### Variável de Ambiente

- **Nome**: `RX_DEMO_MODE`
- **Escopo**: **Server-side apenas** — NUNCA `NEXT_PUBLIC_`. Usar `.env.local` ou variáveis definidas no ambiente de execução.
- **Valor esperado**: `1` (ativo) ou ausente/indistinto (inativo).

### Função de Guard

Criar/utilizar `demoModeEnabled()` que:

```ts
// Arquivo sugerido: src/lib/demoMode.ts (novo)
export function demoModeEnabled(): boolean {
  // 1. Só funciona em desenvolvimento
  if (process.env.NODE_ENV === 'production') {
    return false; // <--- Guardião: produção sempre bloqueia
  }
  // 2. Verifica flag (apenas 1 ativa)
  return process.env.RX_DEMO_MODE === '1';
}
```

### Onde a Guard é Checada

Todas as rotas e páginas que compõem a área de demo devem iniciar com:

```ts
import { demoModeEnabled } from '@/lib/demoMode';

if (!demoModeEnabled()) {
  // Em dev: retorna 404 ou redirect p/ página principal
  // Em produção: 403/503 (já bloqueado pelo guard, mas duplo-check)
  return NextResponse.json(
    { error: 'Modo demo não disponível' },
    { status: process.env.NODE_ENV === 'production' ? 503 : 404 }
  );
}
```

### Defesa Adicional — Build-Time Inline

Para garantir que `NEXT_PUBLIC_RX_DEMO_MODE` **nunca** seja injetado no bundle:

- O valor `RX_DEMO_MODE` é lido apenas em arquivos de rota/server (`*.ts` no `app/api/` e `app/(auth)/`).
- Não use `next config` nem `env` do tipo `NEXT_PUBLIC_` para esta flag.
- Se houver necessidade de passar para o client, usar uma rota `/api/dev/demo-status` que leia a flag server-side e retorne apenas `boolean` (sem expor o nome da env var).

---

## 3. Demo Identity Injection

### Como Funciona

Quando `demoModeEnabled()` retorna `true`, a função `getAuthenticatedUser()` (em `src/lib/auth.ts`) deve retornar um usuário/sessão simulada em vez de `null`. A identidade deve mapear para ** linhas reais** no banco local (UUIDs fixos bem conhecidos), para que:

- Queries Prisma com `where: { organizationId: ... }` funcionem.
- RLS (Row Level Security) seja ativado corretamente via `app.current_org` e `app.current_user_id`.
- Joins `organizationId` em modelos `Contact`, `Lead`, `Deal`, etc. funcionem sem special-case.

### Identidade Demo (UUIDs Fixos)

| Campo | Valor (UUID fixo) | Observação |
|-------|-------------------|------------|
| `user.id` | `00000000-0000-0000-0000-000000000001` | Usuário demo admin |
| `user.email` | `demo@revolutionx.com.br` | Apenas display |
| `organizationId` | `00000000-0000-0000-0000-000000000001` | Org demo |
| `role` | `admin` | Paper org admin |
| `organizationMembers[0].role` | `admin` | Membership primária |

### Implementação em `getAuthenticatedUser`

Modificar `src/lib/auth.ts` — adicionar no início da função, antes da query ao Supabase:

```ts
import { demoModeEnabled } from './demoMode';

// No topo de getAuthenticatedUser, antes do supabase.auth.getUser():
if (demoModeEnabled()) {
  // Retorna identidade demo com UUIDs fixos que existem no banco local
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'demo@revolutionx.com.br' || null,
    organizationId: '00000000-0000-0000-0000-000000000001',
    role: 'admin',
    organizationMembers: [
      { organizationId: '00000000-0000-0000-0000-000000000001', role: 'admin' }
    ]
  } as AuthenticatedUser;
}
// ... resto da função existente
```

### Por que UUIDs fixos no banco local?

O banco de dados local (Supabase Docker) já deve ter linhas de `auth.users`, `Organization`, `OrganizationMember` com estes UUIDs como resultado do seed script (ver seção 5). Isso faz com que:

- `withUserContext(user.id, ...)` funcione — o RLS define `app.current_user_id` e `app.current_org` corretamente.
- Queries como `.where({ organizationId: user.organizationId })` nas models `Contact`, `Lead`, `Deal`, `Campaign`, etc. retornem dados consistentes.
- O cookie `x-organization-id` no middleware seja definido corretamente.

### Seed dos UUIDs no Banco Local

O seed script (seção 5) deve criar:

1. `auth.users` com o usuário `demo@revolutionx.com.br` (ou então usar o GoTrue local com email/senha demo).
2. `Organization` com id `00000000-0000-0000-0000-000000000001` e name `"Demo Organization"`.
3. `OrganizationMember` ligando o usuário à organização com role `admin`.

Essas linhas são **apenas para o ambiente local** (development). O seed deve recusar/se sair graciosamente se `DATABASE_URL` contiver `ardpabjoepzhkpmkgwgu` (produção).

---

## 4. Middleware Implications

### Cookie `x-organization-id`

O middleware atual ( `middleware.ts` linhas 175-193 ) já define o cookie `x-organization-id` para usuários logados. Com o modo demo:

- Quando `demoModeEnabled()` é verdadeiro e o usuário é a identidade demo, o middleware deve definir o cookie para a org demo.
- A lógica atual já busca `members` via service role client. Como a identidade demo tem um `OrganizationMember` real no banco, isso funcionará se:
  - `SUPABASE_SERVICE_ROLE_KEY` estiver configurado no local (ele é).
  - A query `from('OrganizationMember').select('organizationId').eq('userId', user.id)` retorne o registro correto.

**Ação**: Não alterar o middleware. A identidade demo com UUID fixo no banco fará a query retornar o `organizationId` correto, e o cookie será definido automaticamente.

### ROTAS PÚBLICAS vs PRIVADAS no Modo Demo

- **Páginas públicas** (home, sobre, etc.): funcionam normalmente em modo demo, mostrando dados fictícios.
- **API routes privadas** (crm/contacts, whatsapp/send, ai/generate, etc.): devem checar `demoModeEnabled()` no início e, se falso, retornar 401/404. Se verdadeiro, prosseguem com a identidade demo.

---

## 5. Mock Outbound (WhatsApp/IG/FB/Email)

### Objetivo

Em modo demo, os executadores de outbound devem "curto-circuitar" — retornar sucesso imediato e escrever `Message` rows no banco com IDs simulados, sem chamar provedores reais (OpenBSP/Meta/Resend).

### Abordagem: Mock no Adaptador Factory

A maneira mais pequena (ponytail) é adicionar um estágio no `createIntegrationAdapter` ou criar rotas helper que, quando `demoModeEnabled()` é verdadeiro, retornam dados simulados.

#### Opção A: Mock no Adaptador (recomendada — mínima mudança)

No `src/integrations/adapter-factory.ts`, antes de lançar erros de "credenciais não configuradas", checar o modo demo:

```ts
export function createIntegrationAdapter(row: IntegrationRow, client: any): IntegrationAdapter {
  // 0. Modo demo — short-circuit
  if (demoModeEnabled()) {
    // Retorna um adaptador "fantasma" que sempre retorna sucesso
    return new (class DemoAdapter implements IntegrationAdapter {
      matches(channel: Channel, provider?: Provider, connectionMode?: ConnectionMode): boolean {
        return true; // Aceita tudo no demo
      }
      hasCredentials(): boolean { return true; }
      neededCredentialName(): string { return ''; }
      capabilities(): Record<string, unknown> {
        return { name: 'Demo Adapter', needsCredentials: false };
      }
      async connect(organizationId: string): Promise<{ success: boolean; status: AdapterStatus; reason?: string; data?: Record<string, unknown> }> {
        return { success: true, status: 'CONNECTED' };
      }
      async disconnect(integrationId?: string): Promise<{ success: boolean; status: 'DISCONNECTED'; reason?: string }> {
        return { success: true, status: 'DISCONNECTED' };
      }
      async status(): Promise<{ success: boolean; status: AdapterStatus; reason?: string; data?: Record<string, unknown> }> {
        return { success: true, status: 'CONNECTED' };
      }
      async send(data: any): Promise<{ success: boolean; error?: string }> {
        // Escreve uma row Message simulada no banco
        await writeDemoMessage(data);
        return { success: true };
      }
      // ... outros métodos exigidos pela interface
    })();
  }
  // ... resto existente
}
```

#### Escrevendo a Message simulada

Criar uma utilidade `writeDemoMessage` que insere uma row `Message` com:

- `organizationId`: org demo fixa
- `contactId`: UUID de contato seed (ex: `00000000-0000-0000-0000-000000000002`)
- `externalId`: `demo-${Date.now()}`
- `body`: `Mensagem de demo simulada - ${data.body ?? 'sem corpo'}`
- `status`: `sent`
- `direction`: `outbound`
- `fromChannel`: `whatsapp`
- `toContact`: UUID do contato destino

#### Rotas que se beneficiam do mock

| Rota | Superfície coberta |
|------|-------------------|
| `POST /api/whatsapp/send` | Disparo WhatsApp simulado |
| `POST /api/ai/generate` | Geração de IA simulada (resposta fictícia) |
| `POST /api/email/send` (se existir) | E-mail simulado via Resend |
| `POST /api/campaigns` | Criação de campanha simulada |

#### Opção B: Rota `/api/dev/simulate` (alternativa)

Uma rota única que, quando chamada, executa simulações de todos os serviços:

```ts
// app/api/dev/simulate/route.ts
import { demoModeEnabled } from '@/lib/demoMode';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (!demoModeEnabled()) {
    return NextResponse.json({ error: 'Not demo mode' }, { status: 403 });
  }
  
  // Cria alguns registros de mensagem simulada, campanhas, etc.
  // ... lógica de mock
  
  return { ok: true, note: 'Simulação demo executada' };
}
```

**Decisão**: Usar **Opção A** (mock no adaptador factory) pois é mais integrada — as rotas existentes (`/api/whatsapp/send`, etc.) já checam `getAuthenticatedUser`, e ao passarem pela identidade demo, o adaptador factory em modo demo short-circuits automaticamente. Menos código novo, maior cobertura.

---

## 6. Seed Data

### Onde e Como

O seed deve viver em `prisma/seed.ts` (ou `scripts/seed-demo.ts` se preferir, mas manter em `prisma/` é mais consistente com a codebase existente, que não tem seed atual).

#### Script de Seed (prisma/seed-demo.ts)

```ts
// prisma/seed-demo.ts — novo arquivo
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient({
  connectionString: process.env.DATABASE_URL,
});

// UUIDs fixos do modo demo
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_CONTACT_ID = '00000000-0000-0000-0000-000000000002';
const DEMO_LEAD_ID = '00000000-0000-0000-0000-000000000003';
const DEMO_DEAL_ID = '00000000-0000-0000-0000-000000000004';
const DEMO_PIPELINE_ID = '00000000-0000-0000-0000-000000000005';
const DEMO_CAMPAIGN_ID = '00000000-0000-0000-0000-000000000006';

async function main() {
  // 1. Verificar se não é produção
  if (process.env.DATABASE_URL?.includes('ardpabjoepzhkpmkgwgu')) {
    console.error('❌ seed-demo: DATABASE_URL aponta para produção. Recuse.');
    process.exit(1);
  }
  
  // 2. Criar organização demo
  await prisma.organization.create({
    data: {
      id: DEMO_ORG_ID,
      name: 'Demo Organization',
      slug: 'demo',
      status: 'active',
    },
  });
  
  // 3. Criar usuário demo no auth.users via GoTrue local
  // (isso depende do stack local ter GoTrue rodando)
  // ... ou usar supabase admin para criar
  
  // 4. Criar membership
  await prisma.organizationMember.create({
    data: {
      id: '00000000-0000-0000-0000-000000000007',
      organizationId: DEMO_ORG_ID,
      userId: DEMO_USER_ID,
      role: 'admin',
    },
  });
  
  // 5. ~10 Contatos fictícios
  for (let i = 1; i <= 10; i++) {
    await prisma.contact.create({
      data: {
        id: `${DEMO_CONTACT_ID}-${i}`,
        organizationId: DEMO_ORG_ID,
        email: `contato${i}@demo.com`,
        name: `Contato ${i}`,
        phone: `+55${1190000${i}}`,
        waId: `551190000${i}@s.whatsapp.net`,
        consentMarketing: i % 2 === 0, // metade com consentimento
      },
    });
  }
  
  // 6. ~5 Leads
  for (let i = 1; i <= 5; i++) {
    await prisma.lead.create({
      data: {
        id: `${DEMO_LEAD_ID}-${i}`,
        organizationId: DEMO_ORG_ID,
        source: i <= 2 ? 'organic' : 'ads',
        status: i <= 3 ? 'new' : 'qualified',
      },
    });
  }
  
  // 7. 2 Deals
  for (let i = 1; i <= 2; i++) {
    await prisma.deal.create({
      data: {
        id: `${DEMO_DEAL_ID}-${i}`,
        organizationId: DEMO_ORG_ID,
        title: `Demo Deal ${i}`,
        value: 10000 + i * 5000,
        stage: i === 1 ? 'prospecting' : 'negotiation',
      },
    });
  }
  
  // 8. 1 Pipeline
  await prisma.pipeline.create({
    data: {
      id: DEMO_PIPELINE_ID,
      organizationId: DEMO_ORG_ID,
      name: 'Demo Pipeline',
      stages: ['prospecting', 'qualification', 'proposal', 'closing'],
    },
  });
  
  // 9. 2 Campaigns (1 auto, 1 manual)
  await prisma.campaign.create({
    data: {
      id: DEMO_CAMPAIGN_ID,
      organizationId: DEMO_ORG_ID,
      title: 'Demo Campaign Auto',
      channel: 'whatsapp',
      status: 'draft',
      resultKind: 'auto',
      audienceJson: JSON.stringify({ contacts: [DEMO_CONTACT_ID + '1'] }),
      variables: JSON.stringify({ name: 'Demo' }),
    },
  });
  
  await prisma.campaign.create({
    data: {
      id: '00000000-0000-0000-0000-000000000007',
      organizationId: DEMO_ORG_ID,
      title: 'Demo Campaign Manual',
      channel: 'whatsapp',
      status: 'draft',
      resultKind: 'manual',
      audienceJson: JSON.stringify({ contacts: [DEMO_CONTACT_ID + '2'] }),
      variables: JSON.stringify({ name: 'Demo Manual' }),
    },
  });
  
  // 10. Algumas Messages simuladas
  await prisma.message.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000008',
        organizationId: DEMO_ORG_ID,
        contactId: DEMO_CONTACT_ID + '1',
        externalId: 'demo-msg-001',
        body: 'Olá! Esta é uma mensagem de demo simulada.',
        fromChannel: 'whatsapp',
        direction: 'outbound',
        status: 'sent',
      },
      {
        id: '00000000-0000-0000-0000-000000000009',
        organizationId: DEMO_ORG_ID,
        contactId: DEMO_CONTACT_ID + '2',
        externalId: 'demo-msg-002',
        body: 'Segunda mensagem de demo.',
        fromChannel: 'whatsapp',
        direction: 'inbound',
        status: 'received',
      },
    ],
  });
  
  // 11. 2 Posts (IG + FB simulados)
  await prisma.post.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000010',
        organizationId: DEMO_ORG_ID,
        title: 'Post Instagram Demo',
        body: 'Conteúdo de demo do Instagram',
        status: 'published',
      },
      {
        id: '00000000-0000-0000-0000-000000000011',
        organizationId: DEMO_ORG_ID,
        title: 'Post Facebook Demo',
        body: 'Conteúdo de demo do Facebook',
        status: 'published',
      },
    ],
  });
  
  console.log('✅ Seed demo concluído');
}

main();
```

### Idempotência (Upsert)

Como os IDs são fixos, o seed deve usar `upsert` ou `on conflict` para não quebrar se executado duas vezes:

```ts
await prisma.contact.upsert({
  where: { id: `${DEMO_CONTACT_ID}-1` },
  update: { ... },
  create: { ... },
});
```

Ou melhor: deletar antes e criar (já que é demo local apenas):

```ts
await prisma.contact.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
// ... then create
```

### Como Rodar

```powershell
# No diretório do projeto
cd C:\Users\Bruno\.claude\Revolution\X

# Garanta que o Docker Subabase está rodando
docker compose -f supabase-docker/docker-compose.yml up -d

# Defina a DATABASE_URL apontando para o local (já vem no .env.local)
# Rode o seed:
npx prisma db execute --file prisma/seed-demo.ts
# ou usando TSNode:
ts-node prisma/seed-demo.ts
```

### Recusa em Produção

O script deve abortar se:

```ts
if (process.env.DATABASE_URL?.includes('ardpabjoepzhkpmkgwgu')) {
  console.error('❌ seed-demo: DATABASE_URL contém key de produção. Abortando.');
  process.exit(1);
}
```

A string `ardpabjoepzhkpmkgwgu` é o projeto Supabase `id` de produção identificado nas memórias — nunca deve ser tocado por scripts locais.

---

## 7. Login Page Affordance

### Botão "Entrar no Modo Demo"

Na página de login (`app/login/page.tsx` ou componente equivalente), adicionar um botão somente em ambiente de desenvolvimento:

```tsx
{process.env.NODE_ENV !== 'production' && (
  <button
    onClick={() => {
      // POST na rota dev-only
      fetch('/api/dev/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          // Navega para a área demo ou recarrega a página
          window.location.href = '/dev';
        }
      });
    }}
  >
    Entrar no Modo Demo
  </button>
)}
```

### Rota `/api/dev/demo-login`

```ts
// app/api/dev/demo-login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { demoModeEnabled } from '@/lib/demoMode';

export async function POST() {
  // Se já estiver em modo demo, só retorna ok
  if (demoModeEnabled()) {
    return NextResponse.json({ ok: true, redirect: '/dev' });
  }
  
  // Em modo demo, criamos uma sessão no GoTrue local para o usuário demo
  // ou definimos um cookie que getAuthenticatedUser consumirá.
  
  const supabase = await createClient();
  
  // Tenta fazer login no usuário demo no GoTrue local
  // O usuário demo@revolutionx.com.br deve existir no banco local
  const { error } = await supabase.auth.signInWithPassword({
    email: 'demo@revolutionx.com.br',
    password: 'demo123', // senha fixa para demo
  });
  
  if (error) {
    // Se o usuário não existir, criar-íamos ou retornar erro
    return NextResponse.json(
      { ok: false, error: 'Demo user not configured' },
      { status: 500 }
    );
  }
  
  // Cria cookie de sessão que o NextAuth/Supabase SSR consumirá
  // Ou apenas retorna ok e o middleware/página lidará com o redirect
  
  return NextResponse.json({ ok: true, redirect: '/dev' });
}
```

### Fallback: Cookie Signed Demo Session

Alternativa mais simples: em vez de usar `signInWithPassword` no GoTrue (que requer config de e-mail, etc.), definir um cookie assinado:

```ts
// No route /api/dev/demo-login
const demoUserCookie = {
  name: 'demo-user-session',
  value: JSON.stringify({
    userId: '00000000-0000-0000-0000-000000000001',
    orgId: '00000000-0000-0000-0000-000000000001',
    isDemo: true,
  }),
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // demo só em dev, então false
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 1 semana
  },
};

// Definir no response
const response = NextResponse.json({ ok: true });
response.cookies.set(demoUserCookie.name, demoUserCookie.value, demoUserCookie.options);
return response;
```

Em seguida, `getAuthenticatedUser` verificar o cookie primeiro:

```ts
// No topo de getAuthenticatedUser, antes do supabase.auth.getUser():
const cookieStore = await cookies();
const demoCookie = cookieStore.get('demo-user-session');
if (demoCookie?.value && demoModeEnabled()) {
  const { userId, orgId, isDemo } = JSON.parse(demoCookie.value);
  if (isDemo && userId && orgId) {
    return {
      id: userId,
      email: 'demo@revolutionx.com.br' || null,
      organizationId: orgId,
      role: 'admin',
      organizationMembers: [{ organizationId: orgId, role: 'admin' }],
    } as AuthenticatedUser;
  }
}
```

**Decisão recomendada**: O fluxo `signInWithPassword` no GoTrue local, pois ele já está no stack (`supabase-docker` já roda GoTrue) e o login já é um fluxo testado. O cookie signed é uma alternativa se houver problema de configuração do GoTrue no local.

### Proteção — 403/404 se Guard Desativado

Se, por algum motivo, o guard estiver desativado em produção (o que não deveria acontecer), a rota `/api/dev/demo-login` deve retornar 403:

```ts
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Modo demo não disponível em produção' },
      { status: 403 }
    );
  }
  // ... resto
}
```

---

## 8. Tests

### Pequenos Tests para Provar o Guard

Adicionar testes que comprovam:

1. **Guard produção + flag on → desativado**:

```ts
it('produção + RX_DEMO_MODE=1 → demo desativado (404/503)', async () => {
  process.env.NODE_ENV = 'production';
  process.env.RX_DEMO_MODE = '1';
  
  const res = await middleware(req('/api/crm/contacts'));
  // Deve falhar com 503 ou 401, NUNCA retornar dados demo
  expect(res.status).toBe(503); // ou 401 dependendo da ordem de checks
});
```

2. **Dev + flag on → modo demo ativo**:

```ts
it('development + RX_DEMO_MODE=1 → getAuthenticatedUser retorna identidade demo', async () => {
  process.env.NODE_ENV = 'development';
  process.env.RX_DEMO_MODE = '1';
  
  // Mock o supabase para não tentar conexão real
  // ... configuração de mock
  
  const user = await getAuthenticatedUser(req('/api/crm/contacts'));
  // Deve retornar a identidade demo, não null
  expect(user).not.toBeNull();
  expect(user?.id).toBe('00000000-0000-0000-0000-000000000001');
  expect(user?.organizationId).toBe('00000000-0000-0000-0000-000000000001');
});
```

3. **Guard produção sem flag → comportamento unchanged**:

```ts
it('produção sem flag → comportamento normal (503 se sem supabase, 200 se público)', async () => {
  // Limpar flag se estiver setada
  delete process.env.RX_DEMO_MODE;
  process.env.NODE_ENV = 'production';
  
  // API privada sem supabase → 503
  const res1 = await middleware(req('/api/crm/contacts'));
  expect(res1.status).toBe(503);
  
  // Página pública → 200
  const res2 = await middleware(req('/'));
  expect(res2.status).toBe(200);
});
```

### Não Fraquejar Testes Existentes

O princípio "do not weaken tests" (do not weaken tests) deve ser respeitado:

- Novos testes devem ser adicionados em arquivos novos ou seções `describe` novas, não modificando suites existentes.
- Se um teste existente depende de `getAuthenticatedUser` retornar `null` para usuário não logado, garantir que o modo demo não altere isso quando `RX_DEMO_MODE` não estiver setado.
- Usar `beforeEach` para limpar `process.env.RX_DEMO_MODE` em cada teste da suite de auth/middleware.

---

## 9. Rollout Order (Arquivos para Modificar)

Ordem recomendada de edição (mínimo diff, ponytail mode):

1. **`src/lib/demoMode.ts`** (NOVO) — Função `demoModeEnabled()` com guard `NODE_ENV === 'production'`.
2. **`src/lib/auth.ts`** — Inserir checagem no `getAuthenticatedUser` para retornar identidade demo quando a flag estiver ativa.
3. **`prisma/seed-demo.ts`** (NOVO) — Script de seed com UUIDs fixos, idempotente, recusa produção.
4. **`app/api/whatsapp/send/route.ts`** — O adaptador factory em modo demo short-circuits (ver seção 5). *Ou* adicionar checada no início da rota.
5. **`app/api/ai/generate/route.ts`** — Igual ao whatsapp: checar demo no início.
6. **`app/api/dev/demo-login/route.ts`** (NOVO) — Rota POST para login demo.
7. **`app/login/page.tsx` (ou componente)** — Adicionar botão "Entrar no modo demo" condicional a `NODE_ENV !== 'production'`.
8. **`src/tests/middleware-guard.test.ts`** (opcional) — Adicionar testes para o novo guard (sem enfraquecer suites existentes).
9. **`middleware.ts`** — Verificar se necessidade de alteração para definir cookie org demo (provavelmente não necessário se identidade demo tem membership no banco).

### Checklist de Verificação

Após as edições, executar:

```powershell
# 1. Subir stack local
docker compose -f supabase-docker/docker-compose.yml up -d

# 2. Rodar seed demo (apenas se DATABASE_URL local)
npx prisma db execute --file prisma/seed-demo.ts

# 3. Iniciar app dev
npm run dev

# 4. Verificar em http://localhost:3000/dev
# - Página carrega com dados fictícios
# - CRM mostra 10 contatos, 5 leads, 2 deals, 1 pipeline
# - Campanhas aparecem
# - WhatsApp send retorna sucesso simulado

# 5. Verificar que modo produção bloqueia
# - Definir NODE_ENV=production (ou reiniciar com env prod)
# - Acessar /api/dev/demo-status → deve dizer desativado
# - Acessar /dev → deve dar 404 ou redirect

# 6. Verificar login normal ainda funciona
# - Login with credais reais ainda funciona
# - Áreas protegidas ainda exigem auth

# 7. Rodar testes
npm test -- --testPathPattern="middleware-guard|auth" 
# - Todos os testes existentes devem passar
# - Novos testes de demo devem passar
```