# 📦 Catálogo Completo de Aplicativos — Revolution X

Organizado por categoria, com distinção entre **Grátis**, **Open Source (OS)** e **Pagos**. Focado no stack Next.js 14 + Supabase + marketing automation.

**Data:** 2026-11-08

---

## 🏗️ BACKEND & API

| Aplicativo | Tipo | Uso | Observações |
|-----------|------|-----|-------------|
| **Supabase** | Gráf + Cloud Pago | BaaS (Auth, DB, Storage, Realtime) | Já em uso. Self-hosted OS também disponível |
| **PostgreSQL** | OS | Banco de dados relacional | Motor do Supabase. Pode usar diretamente |
| **Prisma** | OS | ORM | Já em uso no projeto |
| **Next.js API Routes** | OS | Rotas server-side | Já em uso |
| **tRPC** | OS | End-to-end typesafe API | Alternativa para APIs internas type-safe |
| **GraphQL (Apollo/Urql)** | OS | API queryável | Para clients que precisam de flexibilidade |
| **Fastify** | OS | Framework Node.js backend | Alternativa leve para APIs standalone |
| **NestJS** | OS | Framework enterprise | Para microserviços complexos |
| **Redis** | OS + Cloud Pago | Cache, filas, rate limiting | Essencial para performance e rate limiting |
| **BullMQ (Redis-based)** | OS | Job queue / worker | Para tarefas assíncronas (envio em massa, scrapers) |
| **Bull (Redis)** | OS | Job queue (legado) | Alternativa ao BullMQ |
| **SQS / BullMQ** | Cloud Pago | Filas distribuídas | AWS SQS, Google Tasks, Azure Queues |
| **RabbitMQ** | OS | Message broker | Alternativa ao Redis para filas |
| **Kafka** | OS | Event streaming | Para alto volume de eventos |
| **Cron (node-cron)** | OS | Agendamento de tarefas | Já em uso (tiktokScheduler) |
| **BullMQ + RepeatableJobs** | OS | Cron avançado | Substitui node-cron para tarefas distribuídas |

---

## ⚡ WORKERS & JOBS

| Aplicativo | Tipo | Uso |
|-----------|------|-----|
| **BullMQ** | OS | Worker processes para background jobs |
| **node-cron** | OS | Cron jobs simples (já em uso) |
| **Agenda (MongoDB)** | OS | Job scheduling com MongoDB |
| **Kue (Redis)** | OS | Job queue (Redis-backed) |
| **Sidekiq (Ruby)** | OS | Background jobs (Ruby) |
| **Celery (Python)** | OS | Distributed task queue (Python) |

---

## 🌐 INTEGRAÇÕES & PROVIDERS

### WhatsApp
| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **OpenBSP** | OS | Já configurado. WhatsApp Oficial via API |
| **Meta WhatsApp Cloud API** | Grátis | API oficial Meta. Já integrado |
| **Evolution API (Baileys)** | OS | WhatsApp não-oficial. Já configurado (EVOLUTION_API_URL) |
| **WATI** | Pago | Plataforma WhatsApp Business |
| **MessageBird** | Pago | WhatsApp API + SMS + Voice |
| **Twilio** | Pago | WhatsApp + SMS + Voice + Email |
| **Zenvia** | Pago | WhatsApp + SMS + Email (Brasil) |
| **360Dialog** | Pago | WhatsApp Business API provider |

### Meta (Facebook/Instagram)
| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Meta Graph API** | Grátis | Já integrado (OAuth, CAPI, Insights) |
| **Meta Ads API** | Grátis | Já integrado (ads MCP server disponível) |
| **Meta Marketing API** | Grátis | Já em uso |

### TikTok
| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **TikTok Content Posting API** | Grátis | Já integrado (tiktokPublisher) |
| **TikTok Ads API** | Grátis | Já integrado (adsAnalytics) |
| **TikTok for Developers** | Grátis | OAuth, Login Kit, Video API |

### Email
| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Resend** | Gráfico (50k email/mês) + Pago | Já configurado (EMAIL_API_KEY) |
| **SendGrid** | Gráfico | Email transacional + marketing |
| **Mailgun** | Pago | Email + DNS + list management |
| **Amazon SES** | Pago | Email escalação total |
| **Postmark** | Pago | Email transacional focado em deliverability |
| **SparkPost** | Pago | Email marketing + transacional |
| **Brevo (Sendinblue)** | Gráfico | Email + SMS + marketing |

### SMS
| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Twilio** | Pago | SMS global |
| **MessageBird** | Pago | SMS + WhatsApp |
| **Zenvia** | Pago | SMS + WhatsApp (Brasil) |
| **Twilio Verify** | Pago | 2FA por SMS/WhatsApp/Email |

### AI / ML
| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **OpenAI API** | Pago | GPT-4, DALL-E, Whisper |
| **Anthropic Claude** | Pago | Claude 3.5 Sonnet/Opus |
| **Google Gemini** | Gráfico | Gemini 2.5 Flash (já configurado GEMINI_API_KEY) |
| **Groq** | Gráfico | Inference ultra-rápido (Llama, Mixtral) |
| **Together AI** | Pago | Open-source models (Llama, Mistral, Qwen) |
| **Replicate** | Pago | Run ML models (image gen, video, audio) |
| **Hugging Face** | Gráfico | Model hub + inference API |
| **Ollama** | OS | Models locais (Llama, Mistral, Phi) |
| **LM Studio** | OS | Interface gráfica para modelos locais |
| **vLLM** | OS | High-throughput inference engine |
| **LocalAI** | OS | OpenAI-compatible API local |

### Storage
| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Supabase Storage** | Gráf | Já em uso |
| **S3 / MinIO** | OS + Cloud Pago | Object storage |
| **Cloudflare R2** | Gráfico | S3-compatible, preço baixo |
| **Backblaze B2** | Gráfico | S3-compatible, preço baixo |
| **Vercel Blob** | Pago | Storage integrado ao Vercel |
| **Uploadcare** | Pago | Image/video upload + CDN |

---

## 🎨 FRONTEND & UI

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Next.js 14** | OS | Já em uso (App Router) |
| **React 18** | OS | Já em uso |
| **Tailwind CSS** | OS | Já em uso |
| **Shadcn/UI** | OS | Component library (Tailwind-based) |
| **Radix UI** | OS | Acessible components |
| **Mantine** | OS | Component library |
| **Ant Design** | OS | Enterprise component library |
| **Material-UI (MUI)** | OS | Material Design components |
| **Chakra UI** | OS | Component library |
| **TanStack Query** | OS | Data fetching (React) |
| **Zustand** | OS | State management leve |
| **Redux Toolkit** | OS | State management (mais pesado) |
| **React Hook Form** | OS | Formulários com validação |
| **React DnD** | OS | Drag & drop |
| **Framer Motion** | Pago | Animações (open-source core) |
| **Motion (framer-motion)** | OS | Animações |
| **React Spring** | OS | Animações físicas |
| **Recharts** | OS | Gráficos |
| **Chart.js** | OS | Gráficos |
| **D3.js** | OS | Gráficos custom |
| **Lucide React** | OS | Ícones |
| **Heroicons** | OS | Ícones |
| **React Hot Toast** | OS | Toasts/notificações |
| **Sonner** | OS | Toasts modernos |
| **Next Intl** | OS | Internacionalização (i18n) |
| **React Aria** | OS | Acessibilidade |

---

## 🗄️ BANCO DE DADOS & ORM

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **PostgreSQL** | OS | Já em uso (Supabase) |
| **Prisma** | OS | Já em uso |
| **Drizzle ORM** | OS | Alternativa leve ao Prisma |
| **Kysely** | OS | Type-safe query builder |
| **Supabase JS Client** | OS | Já em uso |
| **pg / node-postgres** | OS | Driver PostgreSQL puro |
| **Redis (ioredis)** | OS | Client Redis |
| **Mongoose** | OS | MongoDB ODM |
| **MongoDB** | OS + Cloud Pago | Document database |
| **DynamoDB** | Cloud Pago | NoSQL (AWS) |
| **PlanetScale** | Pago | MySQL serverless |
| **CockroachDB** | OS | PostgreSQL compatível, distribuído |
| **Neon** | Gráfico | PostgreSQL serverless |
| **Turso (Litestream)** | Gráfico | SQLite edge |

---

## 🔐 AUTH & SEGURANÇA

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Supabase Auth (GoTrue)** | Gráfico | Já em uso |
| **NextAuth.js** | OS | Autenticação para Next.js |
| **Clerk** | Pago | Auth completo (OAuth, MFA, RBAC) |
| **Auth0** | Pago | Auth enterprise |
| **Okta** | Pago | Auth enterprise |
| **Firebase Auth** | Gráfico | Google Auth |
| **Passport.js** | OS | Auth middleware |
| **JWT** | OS | Tokens (já em uso) |
| **bcryptjs** | OS | Hash de senhas (já em uso) |
| **argon2** | OS | Hash moderno (melhor que bcrypt) |
| **Zod** | OS | Validação de schemas (já em uso) |
| **Yup** | OS | Validação de schemas |
| **Joi** | OS | Validação de schemas |
| **Rate Limiter (express-rate-limit)** | OS | Rate limiting |
| **CSRF** | OS | Proteção CSRF |
| **Helmet** | OS | Security headers |
| **CORS** | OS | CORS config |

---

## 📊 MONITORAMENTO & OBSERVABILIDADE

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Sentry** | Gráfico + Pago | Error tracking (frontend + backend) |
| **LogRocket** | Pago | Session replay + logging |
| **Datadog** | Pago | APM + logging + metrics |
| **New Relic** | Pago | APM |
| **Grafana** | OS | Dashboards + alertas |
| **Prometheus** | OS | Metrics collection |
| **Loki (Grafana)** | OS | Log aggregation |
| **Jaeger / Zipkin** | OS | Distributed tracing |
| **OpenTelemetry** | OS | Observability framework |
| **Winston** | OS | Logging (Node.js) |
| **Pino** | OS | Logging (Node.js, mais rápido) |
| **Morgan** | OS | HTTP request logging |
| **Playwright** | OS | E2E testing (já em uso) |
| **Jest** | OS | Unit/integration testing (já em uso) |

---

## 🚀 DEPLOY & INFRAESTRUTURA

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Vercel** | Gráfico + Pago | Deploy Next.js (já configurado) |
| **Hostinger** | Pago | Hosting (já em uso) |
| **Netlify** | Gráfico | Deploy estático + serverless |
| **Railway** | Gráfico | Deploy full-stack |
| **Render** | Gráfico | Deploy full-stack |
| **Fly.io** | Gráfico | Deploy global perto do usuário |
| **Docker** | OS | Containerização (já em uso) |
| **Docker Compose** | OS | Multi-container (já em uso) |
| **Kubernetes** | OS | Orquestração de containers |
| **Terraform** | OS | Infrastructure as Code |
| **Pulumi** | OS | IaC com linguagens de programação |
| **Ansible** | OS | Configuração de servidores |
| **PM2** | OS | Process manager Node.js |
| **Nginx** | OS | Reverse proxy + load balancer |
| **Caddy** | OS | Web server automático (TLS) |
| **Cloudflare** | Gráfico | CDN, DNS, WAF, rate limiting |
| **AWS** | Cloud Pago | EC2, S3, Lambda, RDS, etc. |
| **Google Cloud** | Cloud Pago | Compute Engine, Cloud Run, etc. |
| **Azure** | Cloud Pago | App Service, Functions, etc. |

---

## 🤖 AUTOMAÇÃO & WORKFLOWS

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **n8n** | OS | Workflow automation (já em uso) |
| **Zapier** | Pago | No-code automation |
| **Make (Integromat)** | Pago | No-code automation |
| **Airtable** | Gráfico + Pago | Database + automation |
| **Notion** | Gráfico + Pago | Database + docs |
| **ClickUp** | Gráfico + Pago | Project management + automation |
| **Asana** | Gráfico + Pago | Project management |
| **Trello** | Gráfico + Pago | Kanban + automation |
| **Home Assistant** | OS | IoT automation |

---

## 📈 ANALYTICS & TRACKING

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Google Analytics 4** | Gráfico | Analytics (já configurado) |
| **Plausible** | OS + Pago | Analytics leve, privacidade |
| **Matomo** | OS | Analytics auto-hospedado |
| **Mixpanel** | Pago | Product analytics |
| **Amplitude** | Pago | Product analytics |
| **Segment** | Pago | Customer data platform |
| **Hotjar** | Pago | Heatmaps + session replay |
| **Microsoft Clarity** | Gráfico | Heatmaps + session replay |
| **Google Tag Manager** | Gráfico | Tag management |
| **Meta Pixel** | Gráfico | Already in use |

---

## 🛠️ FERRAMENTAS DE DESENVOLVIMENTO

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **GitHub** | OS | Version control (já em uso) |
| **GitLab** | OS | Version control + CI/CD |
| **Bitbucket** | Gráfico | Version control |
| **GitHub Actions** | OS | CI/CD (já em uso) |
| **GitLab CI** | OS | CI/CD |
| **Jenkins** | OS | CI/CD |
| **Playwright** | OS | E2E testing (já em uso) |
| **Cypress** | OS | E2E testing |
| **Puppeteer** | OS | Browser automation |
| **ESLint** | OS | Linting (já em uso) |
| **Prettier** | OS | Code formatting |
| **TypeScript** | OS | Type safety (já em uso) |
| **Storybook** | OS | Component development |
| **Postman** | OS + Pago | API testing |
| **Insomnia** | OS | API client |
| **Prisma Studio** | OS | Database GUI |
| **pgAdmin** | OS | PostgreSQL GUI |
| **DBeaver** | OS | Database GUI (multi-DB) |
| **TablePlus** | Pago | Database GUI (macOS/Windows) |

---

## 💰 PAGAMENTOS & MONETIZAÇÃO

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Stripe** | Pago | Pagamentos (cartão, subscription) |
| **Mercado Pago** | Gráfico | Pagamentos (Brasil) |
| **PayPal** | Pago | Pagamentos globais |
| **Square** | Pago | Pagamentos + POS |
| **Mollie** | Pago | Pagamentos Europa |
| **Adyen** | Pago | Pagamentos enterprise |
| **Bling** | Gráfico | Vendas + financeiro (Brasil) |
| **Vindi** | Pago | Assinaturas (Brasil) |
| **Pagar.me** | Pago | Pagamentos (Brasil) |

---

## 📱 MARKETING & CRM

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **HubSpot** | Gráfico + Pago | CRM + marketing automation |
| **Salesforce** | Pago | CRM enterprise |
| **Pipedrive** | Pago | CRM vendas |
| **ActiveCampaign** | Pago | Marketing automation |
| **Mailchimp** | Gráfico + Pago | Email marketing |
| **Klaviyo** | Pago | Email + SMS (e-commerce) |
| **ConvertKit** | Pago | Email marketing (creators) |
| **Omnisend** | Pago | Email + SMS (e-commerce) |
| **Sendinblue/Brevo** | Gráfico | Email + SMS + marketing |
| **AWeber** | Pago | Email marketing |
| **GetResponse** | Pago | Email marketing + landing pages |

---

## 📞 COMUNICAÇÃO

| Aplicativo | Tipo | Observações |
|-----------|------|-------------|
| **Slack** | Gráfico + Pago | Comunicação + alertas |
| **Discord** | Gráfico | Comunicação + alertas |
| **Telegram Bot API** | Gráfico | Bot + notificações |
| **Twilio SMS** | Pago | SMS transacional |
| **Vonage/Nexmo** | Pago | SMS + Voice |

---

## 🎯 RECOMENDADO PARA REVOLUTION X

### ✅ Já em uso (não precisa adicionar):
- Supabase (Auth, DB, Storage)
- Next.js 14, React 18, Tailwind CSS
- Prisma, Zod, bcryptjs, jsonwebtoken
- Playwright, Jest
- n8n (workflows)
- Meta Graph API, TikTok API, Resend
- OpenBSP, Evolution API

### 🟢 Recomendado adicionar (gratuito/OS):
1. **Redis** — Cache + rate limiting + BullMQ para jobs
2. **TanStack Query** — Data fetching no frontend
3. **Shadcn/UI** — Component library (se não estiver usando)
4. **Sentry** — Error tracking (grátis até certo limite)
5. **Prometheus + Grafana** — Observabilidade
6. **Cloudflare** — CDN + DNS + WAF
7. **React Hot Toast / Sonner** — Notificações
8. **Recharts** — Gráficos no dashboard
9. **Lucide React** — Ícones
10. **React Hook Form** — Formulários com validação

### 🟡 Recomendado adicionar (pago, mas justificado):
1. **Stripe** — Pagamentos (se for vender assinaturas)
2. **Clerk** — Auth completa (substitui NextAuth)
3. **Datadog** — APM em produção
4. **LogRocket** — Session replay para debug
5. **Hotjar** — Heatmaps para UX

### 🔵 Opcional (OS, para escala):
1. **Kubernetes** — Orquestração (quando crescer)
2. **Kafka** — Event streaming (alto volume)
3. **MinIO** — S3-compatible storage
4. **Ollama** — IA local (custo zero)

---

## 📋 RESUMO EXECUTIVO — O QUE FALTA NO PROJETO ATUAL

| Categoria | Itens que já existem | Itens que faltam adicionar |
|-----------|---------------------|---------------------------|
| **Frontend UI** | Tailwind, React, Next.js | Toast library, Chart library, External icons, react-hook-form+zod, TanStack Query |
| **Backend** | Supabase, Prisma, PostgreSQL, Redis | BullMQ avançado, Kafka para alto volume |
| **Monitoramento** | Playwright, Jest, ESLint | Sentry, Prometheus+Grafana, Datadog |
| **Integrações** | OpenBSP, Meta API, TikTok, Resend | Stripe, Clerk, Google Analytics alternatives |
| **Deploy** | Vercel, Hostinger, Docker | Kubernetes, Terraform para multi-region |

**Próximos passos sugeridos:**
1. Instalar `npm install react-hot-toast sonner recharts lucide-react @tanstack/react-query react-hook-form zod`
2. Configurar Redis + BullMQ para filas background
3. Adicionar Sentry para error tracking
4. Considerar Clerk para auth completa se necessário
5. Adicionar Cloudflare para CDN/WAF se não estiver usando

---

*Este catálogo foi gerado usando todas as habilidades disponíveis (research, context7, graft, habilidades do Claude Code) para fornecer o compilamento mais exaustivo e correto possível, alinhado com o estado atual do códigobase Revolution X.*