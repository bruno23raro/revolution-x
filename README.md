# REVOLUTION X — SaaS Omnichannel

> Criado em 2026-09-21 dentro de `C:\Users\User\.claude\Revolution\X`
> Arquitetura modular. Nunca destruir o existente.

## FASES (nunca pular)

1. Inicialização + análise de ambiente ✅ (executado agora)
2. Auth + multi-tenant
3. Banco + CRM
4. Produtos + mídia
5. Publicador + calendário
6. Vídeo
7. WhatsApp
8. Central de mensagens
9. Campanhas de tráfego pago
10. IA
11. Relatórios
12. Segurança + produção

## REGRAS
- Nenhuma API inventada.
- Pesquisa documentação oficial antes de implementar.
- Classifique: A) automática | B) homologação | C) assistido | D) manual
- Não armazene senhas; use OAuth/tokens.
- Dados por tenant (`organization_id`).
- Commit pequeno, teste antes de avançar.
- Se precisar de conta externa: mostre tela simples para leigo.

## ESTRUTURA PROPOSTA

```
RevolutionX/
├── apps/
│   ├── web/          (Next.js + React + TS + Tailwind)
│   ├── api/          (REST + Webhooks)
│   └── workers/      (BullMQ + Redis jobs)
├── packages/
│   ├── db/           (PostgreSQL migrations + repos)
│   ├── connectors/   (/meta /whatsapp /instagram /facebook /google-ads /tiktok /olx /linkedin /google-business)
│   └── ai/           (assistente central)
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── integrations.md
│   └── SETUP-LEIGO.md
├── .env.example
├── README.md
└── docker-compose.yml
```

## SERVIÇOS EXTERNOS (estimativa de custo)

| Serviço | Uso | Custo estimado |
|---|---|---|
| PostgreSQL (Neon/Render) | Banco multi-tenant | Gratuito/low-cost inicial |
| Redis (Upstash/Render) | Fila + cache | Gratuito até limite |
| Storage S3-compatível | Arquivos de mídia | Gratuito/low-cost |
| WhatsApp Business API (Meta) | Envio de templates/campanhas | Precisa de conta Meta + aprovação |
| Meta Ads / Google Ads | Tráfego pago | Só gasto quando usuário confirmar |
| OpenAI/Anthropic API | IA de conteúdo | Pay-per-use |

## PRÓXIMO PASSO

Executar FASE 2: autenticação e multi-tenant (users, organizations, roles, permissions).
Antes: analisar arquivo existente se houver código anterior.
