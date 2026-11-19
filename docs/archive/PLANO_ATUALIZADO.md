# PLANO ATUALIZADO — Revolution X FASE 8.0

**Data:** 2026-11-11  
**Estado inicial:** ESTADO_ATUAL.md (próprio documento)  
**Objetivo:** Transformar o Revolution X em SaaS multi-tenant completo, seguro, escalável e operacional.

---

## Visão Geral

O Revolution X já possui uma base robusta para operar como SaaS:

- ✅ Deploy ativo no Hostinger (revolutionx.com.br)
- ✅ 10 migrations aplicadas em produção
- ✅ FORCE RLS em 21 tabelas (isolamento multi-tenant)
- ✅ 712/712 testes passando
- ✅ Build limpo (Exit 0)
- ✅ Meta webhook verificado
- ✅ Segurança headers corretos
- ⏳ Ações humanas pendentes: WABA registration, Facebook Login review

---

## FASE 1 — Diagnóstico Completo e Rebaseline

**Status:** ✅ CONCLUÍDO

Concluído com a criação dos seguintes documentos:

- `ESTADO_ATUAL.md` — Estado completo do projeto
- `PLANO_ATUALIZADO.md` — Plano de ação estruturado

Próximos passos da FASE 1:
- [x] Inventário de integrações
- [x] Reconciliar relatórios anteriores
- [x] Documentar estado atual
- [ ] Documentar plano atualizado

---

## FASE 2 — Base SaaS Multi-tenant

**Status:** 🔄 EM ANDAMENTO

### 2.1 Organizations, Users, Members, Roles
- [ ] Auditar organizações existentes
- [ ] Validar papéis: owner, admin, agent, viewer
- [ ] Implementar permissões granulares
- [ ] Garantir que cada organização acesse só seus dados

### 2.2 RLS e Políticas
- [ ] Confirmar FORCE RLS em todas as tabelas
- [ ] Validar políticas fail-closed
- [ ] Verificar `app.current_org` vs `app.current_org_id`
- [ ] Validar funcionamento com pooling PostgreSQL e transações

### 2.3 API Keys e Audit Logs
- [ ] Implementar geração de API keys por tenant
- [ ] Implementar logs de auditoria

---

## FASE 3 — OpenBSP e Canais

**Status:** 📋 PENDENTE

### 3.1 Validar Implementações Atuais
- [ ] Connect — confirmar endpoint status
- [ ] Embedded Signup — validar onboarding
- [ ] Callback — verificar webhook reception
- [ ] Status — validar recuperação de WABA/phone number
- [ ] Webhooks — confirmar idempotência Meta + OpenBSP
- [ ] Persistência — validar armazenamento de conexões
- [ ] WABA e Phone Number ID — confirmar mapeamento

### 3.2 Arquitetura Multi-tenant
- [ ] Cada conexão pertencer ao tenant correto
- [ ] Múltiplas contas por organização — validar schema

### 3.3 Migração 016
- [ ] **Não aplicar em produção sem autorização explícita**
- [ ] Code review já realizado — classified as NOT IMPLEMENTED IN PRODUCTION
- [ ] Impacto zero no RLS

---

## FASE 4 — CRM Completo

**Status:** 📋 PENDENTE

### 4.1 Contatos
- [ ] Validar cadastro existente
- [ ] Importação CSV — confirmar funcionamento
- [ ] Busca e deduplicação
- [ ] Tags e consentimento

### 4.2 Segmentos
- [ ] Filtros por tags, etapa funil, comportamento, origem, data

### 4.3 Pipeline
- [ ] Pipelines, etapas, leads, deals, empresas, tarefas

### 4.4 Permissões
- [ ] Acesso por papel e organização

---

## FASE 5 — Campanhas e Disparo Controlado

**Status:** 📋 PENDENTE

### 5.1 Funcionalidades
- [ ] Criar campanha
- [ ] Escolher segmento
- [ ] Selecionar template aprovado
- [ ] Definir variáveis
- [ ] Agendar
- [ ] Janela de envio
- [ ] Limite por hora

### 5.2 Controle de Fila
- [ ] BullMQ/Redis ou infraestrutura existente
- [ ] Controle de taxa, deduplicação, retry, backoff
- [ ] Cancelamento e auditoria

### 5.3 Consentimento Obrigatório
- [ ] Registro da origem do consentimento
- [ ] Data, finalidade, histórico
- [ ] Opt-out e lista de supressão
- [ ] Bloqueio de destinatários descadastrados

---

## FASE 6 — Inbox e IA

**Status:** 📋 PENDENTE

### 6.1 Inbox
- [ ] Conversas, mensagens, atribuição de agentes
- [ ] Notas internas, tags, status
- [ ] Respostas rápidas, histórico por contato

### 6.2 Agentes de IA
- [ ] Sugestões de resposta
- [ ] Classificação de intenção
- [ ] Resumo de conversas
- [ ] Próxima ação recomendada
- [ ] Identificação de sentimento
- [ ] Transferência para humano

### 6.3 Modelos
- [ ] Todos os modelos devem usar FreeLLMAPI quando compatível
- [ ] Nenhum agente deve enviar mensagem sem configuração do tenant

---

## FASE 7 — Automações com n8n

**Status:** 📋 PENDENTE

### 7.1 Gatilhos
- [ ] Novo contato, mensagem recebida, status atualizado
- [ ] Lead criado, negócio alterado, tag adicionada
- [ ] Campanha concluída

### 7.2 Ações
- [ ] Enviar mensagem, criar tarefa, mover negócio
- [ ] Adicionar tag, agendar follow-up
- [ ] Chamar webhook externo

### 7.3 Fluxos de Exemplo (ambientes de teste)
1. [ ] Typebot lead → CRM → mensagem boas-vindas simulada
2. [ ] Lead sem resposta → follow-up agendado de teste
3. [ ] Negócio ganho → pesquisa satisfação simulada

---

## FASE 8 — Typebot

**Status:** 📋 PENDENTE

- [ ] Integração Typebot quando ainda não existir
- [ ] Formulário de captura, quiz, funil
- [ ] Webhook, integração CRM
- [ ] Origem de lead, tags, consentimento
- [ ] Evitar duplicação de formulários existentes

---

## FASE 9 — Billing

**Status:** 📋 PENDENTE

- [ ] Stripe ou Asaas (conforme arquitetura existente)
- [ ] Planos, assinaturas, trial, cancelamento
- [ ] Webhooks, limites, créditos, uso
- [ ] Cobrança, histórico
- [ ] Sandbox/test mode
- [ ] Bloqueio suave quando plano expirar

---

## FASE 10 — Dashboard e Administração

**Status:** 📋 PENDENTE

### 10.1 Dashboard do Cliente
- [ ] Métricas por organização: contatos, campanhas, entregas, leituras
- [ ] Custos estimados, uso, receita

### 10.2 Painel Admin do SaaS
- [ ] Tenants, usuários, planos, uso
- [ ] Erros, conexões, saúde do sistema
- [ ] Métricas gerais
- [ ] Permissões distintas admin tenant vs admin SaaS

---

## FASE 11 — Qualidade, Testes e Lançamento

**Status:** 📋 PENDENTE

### 11.1 Testes
- [ ] Testes unitários, integração, rotas
- [ ] Autenticação, RLS, multi-tenant
- [ ] Filas, idempotência, webhook
- [ ] Campanhas, billing
- [ ] Playwright E2E
- [ ] TypeScript, ESLint, Build

### 11.2 Documentação
- [ ] Arquitetura, instalação, variáveis
- [ ] Execução, deploy, banco, migrations
- [ ] OpenBSP, campanhas, filas
- [ ] Webhooks, billing, segurança
- [ ] Operação

---

## FASE 12 — Permissões Máximas e Autonomia

**Status:** 📋 PENDENTE

- [ ] Configurar máximo acesso persistente oficial no Claude Code
- [ ] Permitir autonomia ampla: ler, criar, editar, scripts locais
- [ ] Instalar dependências, executar testes, rodar builds
- [ ] Iniciar serviços locais, usar Git sem descartar alterações
- [ ] Ferramentas autorizadas, delegar tarefas
- [ ] Não usar bypass de segurança, UAC, Defender, firewall

---

## FASE 13 — Relatório e Evidências

**Status:** 📋 PENDENTE

Ao final de cada fase, registrar:
- Agentes utilizados, skills executadas, MCPs utilizados
- Plugins utilizados, CLIs executadas, extensões VS Code
- Configuração FreeLLMAPI
- Arquivos criados e modificados
- Funcionalidades implementadas
- Testes executados e resultados
- Bloqueios e próximas ações
- Classificação: IMPLEMENTADO E TESTADO, INTEGRADO E VALIDADO, etc.

---

## Próximos Passos Imediatos

1. **FASE 1:** ✅ Concluído (ESTADO_ATUAL.md + PLANO_ATUALIZADO.md)
2. **FASE 2:** Iniciar auditoria de organizations/RLS — prioridade alta
3. **FASE 3:** Validar OpenBSP implementations — pendência crítica
4. **Ambiente:** Registrar WABA ID + número WhatsApp em Meta (10 min)
5. **Ambiente:** Configurar GoTrue SMTP — já resolvido, confirmado
6. **External:** Aguardar Facebook Login review — incontrolável

---

## Recursos Disponíveis

- **FreeLLMAPI:** `http://127.0.0.1:3001/v1`
- **VS Code Extensões:** 20+ (Claude Code, Continue, Roo Cline, etc.)
- **MCPs:** Supabase, PostgreSQL, GitHub, Playwright, Firecrawl, Context7, Memory
- **Agents:** 30+ tipos disponíveis (arquitetura, backend, frontend, dba, QA, security, etc.)
- **Skills:** 80+ skills instaladas (cross-review, environment-audit, project-executor, etc.)
- **MCP Servers:** Filesystem, Memory, Docker, GitHub, Postgres, SQLite, Playwright, Brave, SearxNG, Supabase, Vercel, Stripe, Slack, Notion, etc.