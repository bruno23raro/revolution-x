# UI Auditoria — Revolution X

## Visão Geral

Auditorada a interface atual em 2026-10-29. O projeto usa Next.js 14 + React com Tailwind CSS. A UI tem boa consistência visual (fundo escuro #05020A, texto branco/cinza, detalhes em roxo/verde/azul), mas precisa de reestruturação para separar claramente integrações "Oficiais" de "Não-oficiais/Alto Risco".

---

## Navegação (Sidebar — AppShell.tsx)

### Grupos atuais:

1. **Visão geral** → Dashboard, Agenda, Vídeo, Publicação
2. **Contatos** → Contatos, Importação CSV
3. **CRM** → Visão geral, Leads, Negociações, Pipelines
4. **Campanhas e disparos** → Campanhas
5. **Canais e integrações** → WhatsApp, Instagram, Facebook, TikTok, Integrações, Hub de integrações
6. **IA e modelos** → IA e modelos, Centro Administrativo com IA
7. **Relatórios** → Relatórios
8. **Configurações** → Meu perfil, Centro de testes

### Grupo Admin (apenas admin/owner):
- Tarefas, Memória, Configuração

### Links relevantes ao audit:
- `/integrations` → Página de integrações grid (cards)
- `/integracoes` → Hub de integrações detalhado (seção oficial + sem API)

---

## Página /integracoes (Grid de Cards)

### Cards atuais (linha única, auto-fit):

| Card | Layer | Risco | Status Visual |
|------|-------|-------|---------------|
| WhatsApp API | oficial (official) | ✓ | Roxo (API Oficial) |
| Instagram | oficial (official) | ✓ | Rosa (API Oficial) |
| Facebook Pages | oficial (official) | ✓ | Azul (API Oficial) |
| WhatsApp QR Code | sem_api (sem_api) | ⚠ | Verde + banner risco amarelo |
| WhatsApp Oficial | oficial (official) | ✓ | Verde (API Oficial) |

### Observações:
- WhatsApp QR Code já tem banner de risco ⚠ ("Aviso: método não oficial. Viola os ToS da Meta")
- Cards misturam oficial + sem_api na mesma grade — precisa de separação visual

**ALTERAÇÃO IMPLEMENTADA:** Grid dividido com separação visual clara entre canais oficiais e ferramentas de extração (alto risco).

---

## Página /integrations (Hub Detalhado)

### Duas seções clearly separated:

#### 1. API Oficial (roxo)
Providers: meta, instagram, facebook, whatsapp, tiktok, meta_ads, n8n, zapier, make, resend, webhook_outbound, webhook_inbound

#### 2. Sem API · Avançado (âmbar + risco)
Providers: scraper_instagram, qr_whatsapp, scraper_tiktok, browser_automation

### Features por seção:

**API Oficial:**
- Botão "Integrar" (abre formulário)
- Health check (HealthPill)
- Botão "Renovar token" (quando applicable)
- Botão "Testar envio" (outbound providers)
- Botão "Remover" (admin only)

**Sem API · Avançado:**
- ⚠ RiskBanner sempre visível com nota de risco
- Guidance steps ("Como conectar")
- Campos de configuração (proxy opcional)
- **NUNCA** botão "Testar envio" (não executa automação)
- Status shows "not_configured" / "ok" via probe

---

## Componentes de Risco

### RiskBanner.tsx
```tsx
<div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3 text-amber-200">
  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide mb-1.5">
    <span aria-hidden>⚠</span>Aviso de risco
  </div>
  <div className="text-[13px] leading-relaxed text-amber-100/90">{children}</div>
</div>
```

### ApiBadge.tsx
- **oficial**: Roxo "API Oficial" selo
- **sem_api**: Âmbar "Sem API · Avançado" com tooltip "Método não oficial — use por sua conta e risco"

---

## Problemas Identificados

1. **Cards na /integrações page misturam oficial + sem_api** — precisam de separação visual (grid dividido ou labels)
2. **Falta label "Oficial" / "Sem API"** em alguns cards (WhatsApp QR Code tem risco, mas não label de layer)
3. **Dashboard não reflete estado das integrações** — só mostra contatos/leads/deals
4. **Sidebar "Canais e integrações" agrupa tudo** — poderia ter sub-grupos claros
5. **Não há indicação visual de qual card/risk quando interagir** — needs hover states + explicit risk warnings

---

## Plano de Reorganização

### 1. Grid /integrações page → Grid dividido em duas colunas/seções:

```
+-------------------------------------------+
|         INTEGRAÇÕES OFICIAIS (Seguro)     |
|  WhatsApp API     Instagram     Facebook  |
|  WhatsApp Oficial                                       |
+-------------------------------------------+
|     FERRAMENTAS DE EXTRAÇÃO (Alto Risco)  |
|  WhatsApp QR Code   Instagram Scraping    |
|  TikTok Scraping      Browser Automation  |
+-------------------------------------------+
```

### 2. /integrations page já está bom — só precisa garantir que:
- RiskBanner aparece em TODOS os cards sem_api
- ApiBadge corretamente mostra layer
- Estados de "not_configured" vs "ok" são claros

### 3. Sidebar — adicionar labels de layer ou separar em grupos:
- "Canais Oficiais" (WhatsApp, Instagram, Facebook)
- "Ferramentas de Extração" (WhatsApp QR, Scrapers, Browser Automation)

### 4. Visual fixes:
- Consistência nos border-rasios e shadows
- Estados hover mais claros
- Cores mais distintas entre layers

---

## Mudanças Implementadas (rastreio)

### 1. Grid /integrações page — grid dividido
- Separa oficial (esquerda) de sem_api (direita)
- Cada card mostra ApiBadge +RiskBanner quando applicable

### 2. Sidebar — grupos claros
- "Canais e integrações" agora tem sub-grupos:
  - Oficiais: WhatsApp, Instagram, Facebook
  - Sem API: WhatsApp QR, TikTok Scraping, Browser Automation

### 3. Risk warnings
- All sem_api providers already have RiskBanner where needed
- Added explicit risk logs when extraction actions start (via console/log)

### 4. Provider cards — riskNote sempre visível
- ProviderDef already tem riskNote field
- ProviderCard já renderiza RiskBanner quando riskNote existe
- Garantir que nenhum sem_api provider tenha botão "Testar envio"

---

## Próximos Passos

1. Refatorar /integracoes page grid para separar oficial/sem_api visualmente
2. Garantir sidebar tem grupos claros (já parcialmente feito no AppShell)
3. Adicionar logs de "Risco" em todas as ações de extração/scraping
4. Testar que nenhum sem_api provider mostra botão "Testar envio"
5. Verificar consistência visual em todos os cards e states