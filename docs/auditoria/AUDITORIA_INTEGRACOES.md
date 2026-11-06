# AUDITORIA DE INTEGRAÇÕES — Revolution X

> Auditoria 2026-11-06. Para cada integração: viabilidade técnica, oficialidade, requisitos,
> limitações, multi-tenant, risco e recomendação. MCP/automação de navegador NUNCA é
> contado como integração oficial.

## 1. Meta — Login Facebook/Instagram/WhatsApp (OAuth Graph v26)

- **Oficial**: sim (Facebook Login + Graph API). App `1112157761403064` (dev) e `1421814643397349`.
- **Requisitos**: app de desenvolvedor próprio ✅; App Review por escopo; redirect URI cadastrado;
  para produção séria, Business Verification.
- **Estado técnico**: fluxo implementado em DUAS gerações. A antiga (`/api/auth/meta` →
  `/api/auth/callback/meta`) está **quebrada** — o callback foi deletado no commit `1a87fc7`
  e o init continua gerando `redirect_uri` para ele. A nova (`/api/oauth/callback/*`) existe,
  parece completa, mas **nenhuma tela chama os novos callbacks** e o init não aponta para eles.
  `ENABLE_META_OAUTH=false` por decisão de fase (docs/evidence/f2-gate-1.md).
- **Multi-tenant**: sim (tokens por organização, multi-conta com migração 016 — código pronto,
  migration aplicada em produção: coluna display_name confirmada por introspecção).
- **Bloqueios externos (H-1/H-2)**: App Review "Em análise" desde 2026-10-31; System User Token
  exige clique humano no Business Manager — inegociável, não contornável por automação.
- **Veredito**: tecnicamente possível e já quase pronta. Precisa: (a) escolher UMA geração de
  callback e apagar a outra; (b) humanos completarem H-1/H-2; (c) ligar a flag quando aprovada.
- **Risco**: com App Review pendente, o app só funciona para admins/testadores. Para clientes
  reais, review aprovado é pré-requisito absoluto.

## 2. WhatsApp Cloud API direta (WABA)

- **Oficial**: sim. WABA `801885496316680`, token de system user.
- **Estado**: senders/templates/chatbot prontos e testados; depende das mesmas aprovações Meta.
- **Multi-empresa**: com 016, várias WABAs por tenant; tokens por linha.
- **Custo**: Conversas (marketing/utility) cobradas pela Meta por mensagem — o custo é repassado
  ao cliente final; o plano do SaaS precisa embutir ou repassar isso (DECISÃO D-5).

## 3. OpenBSP (WhatsApp "oficial" gerenciado, embedded signup)

- **O que é**: serviço que hospeda a conexão WhatsApp (Cloud API + Evolution embutida) e faz
  onboarding via popup da Meta. Integração oficial "por tabela": o signup usa a UI oficial da
  Meta; o roteamento das mensagens passa pelo provedor.
- **Estado**: backend completo (mint token, callback, incoming, status, templates, disconnect),
  chave validada ao vivo (mint 201 em 2026-10-29). **Zero canais conectados em produção.**
- **Dependências**: `OPENBSP_*` no hPanel; subdomínio callback; verify_token por tenant.
- **Limitações/risco**: é fornecedor terceiro — lock-in, disponibilidade e preço por conexão
  não documentados (desconhecido registrado). Multi-cliente depende do plano comercial deles.
- **Alternativa**: Meta Cloud API direta (item 2) elimina o intermediário para quem tem WABA
  própria; Evolution API self-hosted cobre o modo não-oficial sem o SaaS intermediário.
- **Recomendação**: manter OpenBSP como caminho OFICIAL multi-tenant de menor atrito, mas
  documentar contrato/limites ANTES de vender para clientes (D-6).

## 4. Evolution API (WhatsApp não-oficial/QR)

- **Oficial**: NÃO. Automação sobre WhatsApp Web — viola ToS da Meta; risco de banimento do
  número do cliente. Enquadra-se em "Sem API / Avançado" com RiskBanner (já sinalizado na UI).
- **Estado**: variáveis EVOLUTION_* existem; instância rodando nunca comprovada; cards QR
  na UI sem executor fim-a-fim.
- **Recomendação**: só vale para o modo "assistido" com aviso claro. Não vender como oficial.

## 5. Instagram Graph API

- **Oficial**: sim (via página Facebook vinculada; `instagram_content_publish` etc.).
- **Estado**: publisher (feed/reels, agendamento 10min–75d) pronto + testes; UI removida da
  tela de integrações no WIP atual (ver problema A-3).
- **Limitações**: exige conta Business/Creator vinculada a Página; publicação de story tem
  restrição de 24h; rate limit ~25 posts/24h por conta (documentar para o usuário).

## 6. Facebook Pages API

- **Oficial**: sim. Publisher + agendamento prontos e testados. Marketplace e posts em grupos
  NÃO têm API oficial — qualquer automação aí é navegador + risco de ban (declarado, sem executor).

## 7. TikTok (Login de conteúdo, Posting, Analytics, Ads)

- **Oficial**: sim (TikTok for Developers / Business API).
- **Estado**: publicação PULL_FROM_URL + analytics de vídeo + ads insights (report/object/get)
  implementados com testes; agendamento via tick interno (a API oficial não aceita horário —
  contornável com executor próprio, já feito).
- **Bloqueio**: credenciais BAP (client key/secret) por cliente e token de ads — pendência
  humana de cadastro; app review da TikTok também existe.
- **Multi-tenant**: memória por usuário/org (migration 014) — suportado.

## 8. n8n (WF-01..WF-08)

- **Oficial**: n8n é open source self-hosted ✅ — integração legítima e gratuita.
- **Estado**: workflows versionados; execução de produção via API REST **401 crônico**
  (25+ variações testadas) → hoje depende de MCP cloud (ferramenta de dev, não do produto!).
  **Inbound do produto funciona** (webhook próprio do app).
- **Ação**: o produto NÃO pode depender de MCP cloud. Corrigir auth da API n8n
  (N8N_API_KEY + N8N_ENDPOINT_URL no container) ou mover os fluxos para cron/rotas internas.
  (Há forte suspeita de que o 401 seja chave de outro usuário/instância — resolver é 1 hora
  de debug com acesso ao container.)

## 9. Zapier / Make / webhook genérico (saída)

- **Oficial**: sim (webhooks são o contrato público dessas plataformas).
- **Estado**: executores de saída com HMAC prontos + guia na UI. Prontos para uso, dependem
  só do cliente conectar. ✅

## 10. Resend (e-mail transacional)

- **Oficial**: sim. Produção validada (delivered). Plano gratuito 3k/mês cobre início. ✅

## 11. IA (OmniRouter / gateways)

- Estado: roteador OpenAI-compatível com fallback. Dev: FreeLLMAPI local ✅.
- **Produção: depende de credencial paga** — nenhuma cadeia de IA gratuita testada em prod.
  Alternativas gratuitas viáveis p/ começar: Ollama local no mesmo host Hostinger VPS ou
  modelos gratuitos de provedores com tier free. Decisão de custo: D-7.

## 12. Google Ads (prometido no README, Fase 9)

- ⛔ Nunca implementado. **Viável** (Google Ads API oficial), mas exige token developer,
  OAuth de conta Google e nível de aprovação Basic/Standard. Fora do que existe; manter
  como backlog explícito, não como "quase pronto" (DECISÃO D-8: manter ou remover do roadmap).

## 13. SearXNG / FreeLLMAPI / Ollama (infra local)

- São ferramentas de desenvolvimento/assistência. **Não são funcionalidade do produto** e
  não estão nem podem estar no ar da Hostinger como dependência de produção.

## Matriz-resumo

| Integração | Oficial | Multi-tenant | Bloqueio | Ação |
|---|---|---|---|---|
| Meta OAuth (IG/FB/WA) | ✅ | ✅ | App Review + System User [HUMANO] + 2 gerações de código | Unificar callback; aguardar review |
| WhatsApp Cloud direta | ✅ | ✅ | idem Meta | manter como alternativa a OpenBSP |
| OpenBSP | via Meta | ✅ | nenhum canal conectado; contrato não documentado | ativar 1 canal piloto; documentar SLA |
| Evolution/QR | ❌ ToS | ✅ | instância não comprovada | modo assistido só com aviso |
| Instagram/Facebook pub | ✅ | ✅ | depende OAuth Meta | devolver cards à UI |
| TikTok conteúdo+ads | ✅ | ✅ | credenciais por cliente | backlog de onboarding |
| n8n | ✅ | ✅ | API 401 | corrigir auth ou internalizar jobs |
| Zapier/Make/webhook | ✅ | ✅ | — | pronto |
| Resend | ✅ | n/a | — | pronto |
| IA | gateway | ✅ | credencial prod | decisão de fornecedor |
| Google Ads | ✅ API | possível | nunca iniciado | decidir escopo |
