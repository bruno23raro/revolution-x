# Revolution X - Frontend Architecture Map

**Última atualização:** 12/11/2026
**Status:** Mapeamento completo das rotas, componentes e API

---

## Arquitetura Atual

### Estrutura de Diretórios (Frontend Real)

O projeto usa **Next.js App Router** com duas estruturas:
- `/app/` - Diretório raiz do Next.js (páginas reais)
- `/src/app/` - Diretório legado (páginas antigas não utilizadas)

```
app/
├── layout.tsx                      # Root layout (html, head, FB SDK)
├── page.tsx                        # Landing page pública
├── not-found.tsx                   # Página 404
│
├── auth/
│   ├── login/page.tsx              # Tela de login
│   ├── register/page.tsx           # Registro de usuário
│   ├── forgot-password/page.tsx    # Recuperação de senha
│   └── verify-email/page.tsx       # Verificação de e-mail
│
├── dashboard/page.tsx              # Dashboard principal
├── crm/
│   ├── page.tsx                    # CRM overview
│   ├── contacts/page.tsx           # Lista de contatos
│   ├── contacts/import/page.tsx    # Importação CSV
│   ├── leads/page.tsx              # Gestão de leads
│   ├── deals/page.tsx              # Gestão de deals
│   └── pipelines/page.tsx          # Pipelines de vendas
│
├── campaigns/
│   ├── page.tsx                    # Lista de campanhas
│   └── [id]/page.tsx               # Detalhes da campanha
│
├── whatsapp/
│   ├── page.tsx                    # WhatsApp oficial + QR
│   ├── templates/page.tsx          # Gerenciador de templates
│   ├── templates/client-page.tsx   # Client component templates
│   └── growth/page.tsx             # WhatsApp Growth
│
├── integrations/
│   └── page.tsx                    # OLD - redireciona para /integracoes (308)
│
├── integracoes/                    # PÁGINA PRINCIPAL DE INTEGRAÇÕES
│   └── page.tsx                    # Grid de cards com OpenBSP
│
├── instagram/
│   └── page.tsx                    # Instagram oficial
│
├── facebook/
│   └── page.tsx                    # Facebook oficial
│
├── tiktok/
│   └── page.tsx                    # TikTok (em desenvolvimento)
│
├── calendar/
│   └── page.tsx                    # Agenda (placeholder)
│
├── video/
│   └── page.tsx                    # Publicação de vídeo
│
├── publisher/
│   └── page.tsx                    # Publicação multimodal
│
├── ai/
│   └── page.tsx                    # IA e modelos
│
├── reports/
│   └── page.tsx                    # Relatórios
│
├── testcenter/
│   └── page.tsx                    # Centro de testes
│
├── account/
│   └── page.tsx                    # Perfil do usuário
│
├── admin/
│   ├── tasks/page.tsx              # Gerenciamento de tarefas
│   ├── memory/page.tsx             # Interface de memória
│   ├── settings/page.tsx           # Configurações
│   └── chat/page.tsx               # Admin chat (OmniRouter)
│
├── scrapers/
│   ├── whatsapp-groups/page.tsx    # Scraper grupos WhatsApp
│   ├── instagram-profile/page.tsx  # Scraper perfis Instagram
│   ├── facebook-groups/page.tsx    # Scraper grupos Facebook
│   ├── mass-dm/page.tsx            # Mass DM
│   └── google-maps/page.tsx        # Google Maps scraper
│
├── growth/
│   ├── analytics/page.tsx          # Analytics de growth
│   └── leads/page.tsx              # Leads do growth
│
├── hub-integracoes/page.tsx        # Hub de integrações
│
├── privacy-policy/page.tsx         # Política de privacidade
├── terms-of-service/page.tsx       # Termos de serviço
│
├── dev/
│   ├── page.tsx                    # Página dev
│   └── layout.tsx                  # Layout dev
│
├── onboarding/
│   ├── success/page.tsx            # Onboarding sucesso
│   └── error/page.tsx              # Onboarding erro
│
├── reset-password/
│   └── page.tsx                    # Reset de senha
│
└── forgot-password/
    └── page.tsx                    # Esqueci a senha
```

---

## MAPA DE ROTAS (Completo)

### Páginas Públicas (Autenticação)

| Rota | Arquivo | Função | API Dependencies |
|------|---------|--------|------------------|
| `/` | `app/page.tsx` | Landing page | `/api/auth/session` |
| `/login` | `app/login/page.tsx` | Login | `/api/auth/login` |
| `/register` | `app/register/page.tsx` | Registro | `/api/auth/register` |
| `/verify-email` | `app/verify-email/page.tsx` | Verificação e-mail | `/api/auth/verify-email` |
| `/forgot-password` | `app/forgot-password/page.tsx` | Recuperação senha | `/api/auth/forgot-password` |
| `/reset-password` | `app/reset-password/page.tsx` | Reset senha | `/api/auth/reset-password` |
| `/privacy-policy` | `app/privacy-policy/page.tsx` | Política de privacidade | - |
| `/terms-of-service` | `app/terms-of-service/page.tsx` | Termos de serviço | - |

### Páginas Autenticadas

| Rota | Arquivo | Função | API Dependencies |
|------|---------|--------|------------------|
| `/dashboard` | `app/dashboard/page.tsx` | Dashboard principal | `/api/auth/session` |
| `/crm` | `app/crm/page.tsx` | Overview CRM | `/api/auth/session` |
| `/crm/contacts` | `app/crm/contacts/page.tsx` | Lista contatos | `/api/crm/contacts` |
| `/crm/contacts/import` | `app/crm/contacts/import/page.tsx` | Importação CSV | `/api/crm/contacts/import` |
| `/crm/leads` | `app/crm/leads/page.tsx` | Leads | `/api/crm/leads` |
| `/crm/deals` | `app/crm/deals/page.tsx` | Deals | `/api/crm/deals` |
| `/crm/pipelines` | `app/crm/pipelines/page.tsx` | Pipelines | `/api/crm/pipelines` |
| `/campaigns` | `app/campaigns/page.tsx` | Campanhas | `/api/campaigns` |
| `/campaigns/[id]` | `app/campaigns/[id]/page.tsx` | Detalhes campanha | `/api/campaigns/[id]` |
| `/integracoes` | `app/integracoes/page.tsx` | **PÁGINA PRINCIPAL** | `/api/integrations/status`, `/api/integrations/openbsp/connect`, `/api/integrations/disconnect` |
| `/integrations` | `app/integrations/page.tsx` | Legacy 308 redirect | - |
| `/whatsapp` | `app/whatsapp/page.tsx` | WhatsApp | `/api/integrations/status` |
| `/instagram` | `app/instagram/page.tsx` | Instagram | `/api/integrations/status` |
| `/facebook` | `app/facebook/page.tsx` | Facebook | `/api/integrations/status` |
| `/tiktok` | `app/tiktok/page.tsx` | TikTok | `/api/tiktok/status` |
| `/ai` | `app/ai/page.tsx` | IA e modelos | `/api/ai/models` |
| `/reports` | `app/reports/page.tsx` | Relatórios | `/api/reports` |
| `/account` | `app/account/page.tsx` | Perfil usuário | `/api/auth/session` |
| `/testcenter` | `app/testcenter/page.tsx` | Centro de testes | `/api/dev/status` |

### Páginas Admin (role: admin|owner)

| Rota | Arquivo | Função |
|------|---------|--------|
| `/admin/tasks` | `app/admin/tasks/page.tsx` | Gerenciamento de tarefas |
| `/admin/memory` | `app/admin/memory/page.tsx` | Interface de memória |
| `/admin/settings` | `app/admin/settings/page.tsx` | Configurações |
| `/admin/chat` | `app/admin/chat/page.tsx` | Admin chat (OmniRouter) |
| `/admin/alerts` | `app/admin/alerts/page.tsx` | Alertas do sistema |
| `/admin/ai-config` | `app/admin/ai-config/page.tsx` | Config AI |

### Páginas Scrapers (Risco Alto - ToS Violação)

| Rota | Arquivo | Risco |
|------|---------|-------|
| `/scrapers/whatsapp-groups` | `app/scrapers/whatsapp-groups/page.tsx` | Alto - Banimento |
| `/scrapers/instagram-profile` | `app/scrapers/instagram-profile/page.tsx` | Alto - Banimento |
| `/scrapers/facebook-groups` | `app/scrapers/facebook-groups/page.tsx` | Alto - Banimento |
| `/scrapers/mass-dm` | `app/scrapers/mass-dm/page.tsx` | Alto - Banimento |
| `/scrapers/google-maps` | `app/scrapers/google-maps/page.tsx` | Alto - ToS violado |

---

## Componentes Principais

### AppShell.tsx (Componente de Layout)
- **Arquivo:** `src/components/AppShell.tsx`
- **Função:** Sidebar de navegação com 7 grupos (Visão geral, Contatos, CRM, Campanhas, Canais, Ferramentas de extração, IA, Relatórios, Configurações)
- **Auth:** Lê `/api/auth/session` para determinar autenticação e role
- **Admin Group:** Visível apenas para `role === 'admin' | 'owner'`

### IntegrationCard.tsx
- **Arquivo:** `src/components/integrations/IntegrationCard.tsx`
- **Props:**
  - `channel`: 'whatsapp' | 'instagram' | 'facebook'
  - `mode`: 'OFFICIAL' | 'MANUAL'
  - `title`: string
  - `subtitle`: string
  - `icon`: ReactNode
  - `status`: IntegrationStatus
  - `onDisconnect`: function - **BUG CRÍTICO**

### WhatsAppOfficialCard.tsx
- **Arquivo:** `src/components/integrations/WhatsAppOfficialCard.tsx`
- **Props:**
  - `onConnected`: function
  - `onDisconnect`: function
  - `accounts`: AccountRow[]
  - `onRemoveAccount`: function

### ManualAccountsCard.tsx
- **Arquivo:** `src/components/integrations/ManualAccountsCard.tsx`
- **Props:**
  - `whatsappUsed`: number
  - `whatsappMax`: number
  - `onConnected`: function

---

## API Endpoints Mapeados

### Auth API

| Endpoint | Método | Função | Arquivo |
|----------|--------|--------|---------|
| `/api/auth/session` | GET | Obter sessão atual | `app/api/auth/session/route.ts` |
| `/api/auth/login` | POST | Login (Meta OAuth) | `app/api/auth/login/route.ts` |
| `/api/auth/register` | POST | Registro | `app/api/auth/register/route.ts` |
| `/api/auth/logout` | POST | Logout | `app/api/auth/logout/route.ts` |
| `/api/auth/forgot-password` | POST | Recuperar senha | `app/api/auth/forgot-password/route.ts` |
| `/api/auth/verify-email` | POST | Verificar e-mail | `app/api/auth/verify-email/route.ts` |
| `/api/auth/reset-password` | POST | Reset senha | `app/api/auth/reset-password/route.ts` |
| `/api/auth/meta` | POST | Auth Meta OAuth | `app/api/auth/meta/route.ts` |
| `/api/auth/callback/meta` | GET | Callback OAuth Meta | `app/api/auth/callback/meta/route.ts` |
| `/api/auth/tiktok` | POST | Auth TikTok OAuth | `app/api/auth/tiktok/route.ts` |

### Integrações API

| Endpoint | Método | Função | Arquivo | Status |
|----------|--------|--------|---------|--------|
| `/api/integrations/status` | GET | Status de integrações | `app/api/integrations/status/route.ts` | ✅ REAL |
| `/api/integrations/openbsp/connect` | POST | Conectar via OpenBSP | `app/api/integrations/openbsp/connect/route.ts` | ✅ REAL |
| `/api/integrations/openbsp/callback` | GET | Callback OpenBSP | `app/api/integrations/openbsp/callback/route.ts` | ✅ REAL |
| `/api/integrations/openbsp/status` | GET | Status OpenBSP | `app/api/integrations/openbsp/status/route.ts` | ✅ REAL |
| `/api/integrations/openbsp/disconnect` | POST | Desconectar | - | ✅ REAL |
| `/api/integrations/disconnect` | POST | Desconectar genérico | `app/api/integrations/disconnect/route.ts` | ✅ REAL |
| `/api/integrations/manual/connect` | POST | Conectar manual (QR/Evolution) | `app/api/integrations/manual/connect/route.ts` | ⚠️ Parcial |
| `/api/integrations/manual/verify` | POST | Verificar conta manual | `app/api/integrations/manual/verify/route.ts` | ⚠️ Parcial |
| `/api/integrations/meta/refresh-token` | POST | Refresh token Meta | `app/api/integrations/meta/refresh-token/route.ts` | ⚠️ Parcial |
| `/api/integrations/tiktok` | POST | Conectar TikTok | `app/api/integrations/tiktok/route.ts` | ⚠️ Em desenvolvimento |
| `/api/integrations/whatsapp-official/status` | GET | Status WhatsApp oficial | - | ✅ REAL |
| `/api/integrations/whatsapp-official/disconnect` | POST | Desconectar WhatsApp oficial | - | ✅ REAL |
| `/api/integrations/config` | GET | Configurações | `app/api/integrations/config/route.ts` | ✅ REAL |
| `/api/integrations/health` | GET | Health check | `app/api/integrations/health/route.ts` | ✅ REAL |

### CRM API

| Endpoint | Método | Função | Arquivo |
|----------|--------|--------|---------|
| `/api/crm/contacts` | GET/POST | Contatos | `app/api/crm/contacts/route.ts` |
| `/api/crm/contacts/import` | POST | Importação CSV | `app/api/crm/contacts/import/route.ts` |
| `/api/crm/leads` | GET | Leads | `app/api/crm/leads/route.ts` |
| `/api/crm/deals` | GET | Deals | `app/api/crm/deals/route.ts` |
| `/api/crm/pipelines` | GET | Pipelines | `app/api/crm/pipelines/route.ts` |

### WhatsApp API

| Endpoint | Método | Função | Arquivo |
|----------|--------|--------|---------|
| `/api/whatsapp/send` | POST | Enviar mensagem | `app/api/whatsapp/send/route.ts` |
| `/api/whatsapp/qr` | GET | Gerar QR Code | `app/api/whatsapp/qr/route.ts` |
| `/api/whatsapp/templates` | GET/POST | Templates | `app/api/whatsapp/templates/route.ts` |
| `/api/whatsapp/templates/[id]` | GET/POST | Template específico | `app/api/whatsapp/templates/[id]/route.ts` |
| `/api/whatsapp/templates/[id]/sync` | POST | Sincronizar template | `app/api/whatsapp/templates/[id]/sync/route.ts` |
| `/api/whatsapp/chatbot` | POST | Chatbot | `app/api/whatsapp/chatbot/route.ts` |

### Meta/Instagram/Facebook API

| Endpoint | Método | Função | Arquivo |
|----------|--------|--------|---------|
| `/api/meta/ads-insights` | GET | Ads insights | `app/api/meta/ads-insights/route.ts` |
| `/api/instagram/accounts` | GET | Contas Instagram | `app/api/instagram/accounts/route.ts` |
| `/api/instagram/publish` | POST | Publicar Instagram | `app/api/instagram/publish/route.ts` |
| `/api/facebook/publish` | POST | Publicar Facebook | `app/api/facebook/publish/route.ts` |
| `/api/webhooks/meta` | POST | Webhook Meta | `app/api/webhooks/meta/route.ts` |
| `/api/webhooks/openbsp` | POST | Webhook OpenBSP | `app/api/webhooks/openbsp/route.ts` |

### Admin API

| Endpoint | Método | Função | Arquivo |
|----------|--------|--------|---------|
| `/api/admin/tasks` | GET/POST | Tarefas | `app/api/admin/tasks/route.ts` |
| `/api/admin/memory` | GET | Memória | `app/api/admin/memory/page.tsx` |
| `/api/admin/settings` | GET/POST | Configurações | `app/api/admin/settings/route.ts` |
| `/api/admin/chat` | GET | Chat admin | `app/api/admin/chat/page.tsx` |
| `/api/admin/alerts` | GET | Alertas | `app/api/admin/alerts/route.ts` |
| `/api/admin/ai-config` | GET/POST | Config AI | `app/api/admin/ai-config/route.ts` |

### Dev API

| Endpoint | Método | Função | Arquivo |
|----------|--------|--------|---------|
| `/api/dev/status` | GET | Status dev | `app/api/dev/status/route.ts` |
| `/api/dev/demo-login` | POST | Login demo | `app/api/dev/demo-login/route.ts` |

### Outros

| Endpoint | Método | Função |
|----------|--------|--------|
| `/api/ai/generate` | POST | Gerar IA |
| `/api/ai/models` | GET | Modelos IA |
| `/api/campaigns` | GET/POST | Campanhas |
| `/api/schedules` | GET | Agendas |
| `/api/social/growth/send` | POST | Enviar growth |
| `/api/social/growth/extract` | POST | Extrair growth |

---

## Busca a BUGs Encontrados

### CRITICAL BUG - IntegrationCard.tsx (LINHAS 261 E 283)

**Arquivo:** `src/components/integrations/IntegrationCard.tsx`
**Localização:** Linhas 261 e 283 no `onDisconnect`

```tsx
// BUGGY CODE (LINHA 261):
onDisconnect={() => card.defaultOnConnect?.()}

// BUGGY CODE (LINHA 283):
onDisconnect={() => card.defaultOnConnect?.()}
```

**Problema:** O `onDisconnect` está ligado a `defaultOnConnect()` que é uma função `console.log()` placeholder!

**Impacto:** Quando o usuário clica em "Desconectar", nada acontece - apenas log no console.

**Código problemático em src/app/integracoes/page.tsx (linhas 261, 283):**
```tsx
<IntegrationCard
  key={idx}
  channel={card.channel}
  mode={mode}
  title={card.title}
  subtitle={card.subtitle}
  icon={card.icon}
  onDisconnect={() => card.defaultOnConnect?.()}  // <-- BUG!
/>
```

**Definição de defaultOnConnect (src/app/integracoes/page.tsx):**
```tsx
defaultOnConnect: () => console.log('WhatsApp Oficial: conectar via OpenBSP'),
defaultOnConnect: () => console.log('Instagram Oficial: configurar credenciais'),
defaultOnConnect: () => console.log('Facebook Oficial: conectar conta'),
defaultOnConnect: () => console.log('WhatsApp Manual: gerar QR Code'),
defaultOnConnect: () => console.log('Instagram Manual: login via session'),
defaultOnConnect: () => console.log('Facebook Manual: login via session'),
```

**Solução:** Passar a função real de desconexão:
```tsx
onDisconnect={() => handleDisconnect(card.channel, card.mode)}
```

---

### BUG - src/repositories/userRepo.ts (STUB)

**Arquivo:** `src/repositories/userRepo.ts`
**Status:** ⚠️ **STUB** - todas as funções retornam `null`

**Impacto:** Auth flow depende desse repo mas não funciona sem PostgreSQL + migrations reais.

---

### LACUNA - Falta API de sincronização

**APIs NÃO EXISTEM:**
- `/api/integrations/sync-contacts/{channel}`
- `/api/integrations/send-campaign/{channel}`

**Impacto:** Botão "Sincronizar Contatos" não implementado.

---

## Fluxo de Dados (Autenticação)

```
User (Browser)
    ↓ [POST /api/auth/login]
Auth Service (src/lib/auth.ts)
    ↓ [setTenantContext(userId, orgId)]
Supabase Client (RLS via app.current_org)
    ↓ [SELECT/INSERT/UPDATE]
PostgreSQL (64 tabelas com RLS habilitado)
```

---

## Tipos e Interfaces

### IntegrationCard Props

```typescript
interface IntegrationCardProps {
  channel: 'whatsapp' | 'instagram' | 'facebook';
  mode?: 'OFFICIAL' | 'MANUAL';
  title: string;
  subtitle: string;
  icon: ReactNode;
  status?: IntegrationStatus | null;
  actions?: ReactNode;
  onDisconnect?: () => void;
  accounts?: AccountRow[];
  onRemoveAccount?: (accountId: string) => void;
  children?: ReactNode;
  reloadOnMount?: boolean;
}

interface IntegrationStatus {
  connected: boolean;
  error?: string | null;
  accountRef?: string | null;
  mode?: 'OFFICIAL' | 'MANUAL';
}

interface AccountRow {
  id: string;
  status: string;
  metaAccountId: string | null;
  label?: string | null;
  createdAt?: string;
}
```

---

## Estado das Integrações

| Canal | Modo | Status | Implementação |
|-------|------|--------|---------------|
| WhatsApp | OFFICIAL | ✅ Real | Meta Cloud API via OpenBSP |
| Instagram | OFFICIAL | ✅ Real | Graph API Meta OAuth |
| Facebook | OFFICIAL | ✅ Real | Graph API Meta OAuth |
| WhatsApp | MANUAL | ⚠️ Partial | Evolution API (conexão funcional, mas UI placeholder) |
| Instagram | MANUAL | ⚠️ Partial | Session Login (placeholder) |
| Facebook | MANUAL | ⚠️ Partial | Session Login (placeholder) |
| TikTok | OFFICIAL | ⚠️ Dev | OAuth em desenvolvimento |
| Google Maps | MANUAL | ⚠️ Dev | Scraper em desenvolvimento |

---

## Testes Existente

- `src/tests/token-rls.test.ts` - Testes de token com RLS
- `src/tests/b4-rls.test.ts` - Testes RLS básicos
- `src/tests/meta-idor.test.ts` - IDOR Meta
- `src/tests/auth-security.test.ts` - Security auth
- `src/tests/omni-router.test.ts` - Router tests
- `src/integrations/meta/whatsappProcessor.test.ts` - WhatsApp processor
- `app/api/auth/register/route.test.ts` - Registro auth

---

## Status Resumo

| Camada | Status | Comentário |
|--------|--------|------------|
| Frontend Base | ✅ | Todas as páginas funcionais |
| WhatsApp Oficial API | ✅ | Meta Cloud API integrado via OpenBSP |
| Autenticação | ✅ | Login Meta OAuth funcionando |
| RLS/Multitenant | ✅ | 64 tabelas protegidas |
| Conexão Manual | ⚠️ | UI funcional, mas backend parcial |
| Disconnect Bug | ❌ | CRÍTICO - onDisconnect quebra |
| Sincronização | ❌ | APIs não criadas |
| TikTok | ⚠️ | Em desenvolvimento |

---

## Próximos Passos Recomendados

1. **[CRÍTICO]** Corrigir bug do `onDisconnect` em IntegrationCard.tsx
2. **Implementar APIs de sincronização:** `/api/integrations/sync-contacts/{channel}`
3. **Implementar APIs de campanha:** `/api/integrations/send-campaign/{channel}`
4. **Finalizar integração TikTok OAuth**
5. **Ativar conexão manual WhatsApp via Evolution API**

---

## Arquivos de Referência

- **CLAUDE.md** - Regras globais de trabalho
- **MEMORY.md** - Memória persistente do projeto
- **docs/FINAL_READINESS_REPORT.md** - Status de produção
- **docs/FINAL_AUDIT_REPORT_2026-10-19.md** - Relatório de auditoria
- **artifacts/RX_WHATSAPP_OFFICIAL_FINAL_REPORT.md** - Relatório WhatsApp

---

## Notas Técnicas

### Diretório Legado vs Real

O diretório `src/app/integracoes/page.tsx` é **LEGADO** e não é utilizado pela aplicação. A página real está em `app/integracoes/page.tsx`.

A rota `/integrations` (inglês) redireciona permanentemente (308) para `/integracoes` (português).

### Tailwind Config

O projeto usa Tailwind CSS com tema escuro customizado:
- Background: `#05020A`
- Border: `white/10`
- Text: `white`, `gray-400`, `gray-300`
- Accent: `purple-500`, `green-500`, `amber-500`, `pink-400`, `blue-400`, `red-400`