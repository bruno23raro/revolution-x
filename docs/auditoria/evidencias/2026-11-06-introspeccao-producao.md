# Evidência bruta — introspecção banco de PRODUÇÃO (somente-leitura, 2026-11-06)

## Query: tabelas
TABLES(41): AdminAlert, AgentMemory, BillingEvent, CalendarEvent, Campaign,
CampaignRecipient, Contact, Deal, EmailVerificationToken, Lead, Media, Message,
Organization, OrganizationMember, PasswordResetToken, Permission, Pipeline, Plan,
Post, Product, Report, RiskLog, Role, ScraperConfig, Session, Subscription, Task,
TaskEvent, TaskStep, Usage, User, Video, _prisma_migrations, growth_leads,
integration_events, integrations, meta_integrations, webhook_events,
whatsapp_channels, whatsapp_instances, whatsapp_templates

## Query: RLS
RLS ENABLED (5): AdminAlert*, growth_leads*, integration_events(sem force),
integrations*, whatsapp_instances*   (* = FORCE)
POLICIES (6):
  AdminAlert | AdminAlert_tenant | ALL
  growth_leads | growth_leads_org | ALL
  integration_events | integration_events_service_role | ALL
  integration_events | integration_events_tenant | ALL
  integrations | integrations_user | ALL
  whatsapp_instances | whatsapp_instances_org | ALL

## Query: ledger / dados
_prisma_migrations rows: 2
meta_integrations rows: 0

## Query: colunas das migrations recentes (presentes em produção)
meta_integrations.display_name          OK (016 aplicada)
integrations.user_id                    OK (024)
integrations.external_account_id        OK (026)
integrations.connection_mode            OK (021/024)
integration_events.workspace_id|payload|user_id  OK (027)

## Conexão viva (produção HTTP)
GET https://revolutionx.com.br/            -> 200
GET /api/auth/session                      -> 401 (esperado)
GET /integrations                          -> 308 (para /integracoes)
API github.com/repos/bruno23raro/revolution-x -> private:false, pushed_at 2026-11-06
