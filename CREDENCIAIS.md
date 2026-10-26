# CREDENCIAIS — Revolution X SaaS (updated)

## 🔐 Variáveis de Ambiente (.env.local — Produção)

| Chave | Valor Completo | Onde Vive | Para que Serve |
|-------|---------------|-----------|----------------|
| `DATABASE_URL` | `postgresql://postgres.ardpabjoepzhkpmkgwgu:MWf4HWz66Vx1EMMw@aws-0-sa-east-1.pooler.supabase.com:5432/postgres` | `.env.local` | Conexão principal com banco Supabase Postgres (pooler) |
| `DIRECT_URL` | `postgresql://postgres.ardpabjoepzhkpmkgwgu:MWf4HWz66Vx1EMMw@aws-0-sa-east-1.pooler.supabase.com:5432/postgres` | `.env.local` | Conexão direta (non-pooler) com Supabase Postgres |
| `JWT_SECRET` | `9f3b145115176c2087df28365610a6f0b3ace47b5135fad2ecabe118b48ca3c5` | `.env.local` | Segredo para assinatura JWT — **já girado** (antes era placeholder) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ardpabjoepzhkpmkgwgu.supabase.co` | `.env.local` | URL pública do projeto Supabase (usado no frontend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_XJ7GF2EDFcmYKNeaB3YucA_LbbEBdOi` | `.env.local` | Chave anônima pública do Supabase (frontend) |
| `META_APP_ID` | `1112157761403064` | `.env.local` | ID do aplicativo no Meta Developers (Facebook/Instagram/WhatsApp) |
| `META_APP_SECRET` | `ff2edcdec00e1e843433b860c717a3ab` | `.env.local` | Segredo do app Meta — usado para HMAC no webhook WhatsApp |
| `META_WEBHOOK_VERIFY_TOKEN` | `0b1e361df76b89b0e1f2985d830fe6d5` | `.env.local` | Token de verificação do webhook Meta — **consistente com .env.local** |
| `META_TOKEN_ENCRYPTION_KEY` | `0ea4545d39cfc8e9696fa36e92af84ecc304b5744f90f8118482b7e228c1b9da` | `.env.local` | Chave de criptografia AES para dados sensíveis do WhatsApp |
| `CRON_SECRET` | `fc89d97712bc25f35cb4fb68f8d57df79518369743bbbeab55292c7f63086019` | `.env.local` | Segredo para jobs cron — **agora presente** |
| `NEXT_PUBLIC_SITE_URL` | `https://revolutionx.com.br` | `.env.local` | URL do site — **agora presente** |
| `WHATSAPP_PHONE_NUMBER_ID` | `+55 11 91734-5249` | `.env.local` | Phone Number ID do WhatsApp Cloud API — **número de teste brasileiro** |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | *[pending]* | `.env.local` | WABA ID da Conta de Negócios WhatsApp — **pendente de cadastro no Meta** |
| `WHATSAPP_ACCESS_TOKEN` | `EAAPzgGhNeLgBS6PcDJ9WZCJBN9KAirlyGYkUIA91lYbTAZAIX1Q1XF5nCTa6ehybrLSosaUtWTsok6KoA45GTjMdcU7poH1F776BnZAvOvaeyHAFqGF1v2EZBTrEkZCpbKQwZABw2Y5tWFcCZBHLQVKZCK6xjZBxwbYiavxrAj87cKHxZBXZCOiFue4sWrG62yYvkLKKWyuBqvKZBugioR1M4wmUGDCceXwzWZCNCABVla4x2hZBd4GbAb5D0wLYZBuDZAd9hMjeClRZCHKZBm5OZAyflXPI18v` | `.env.local` | Access Token permanente do WhatsApp Cloud API — **token permanente recebido** |

### 🌐 WhatsApp Cloud API

| Chave | Valor Completo | Onde Vive | Para que Serve |
|-------|---------------|-----------|----------------|
| `WHATSAPP_PHONE_NUMBER_ID` | `+55 11 91734-5249` | `.env.local` | Phone Number ID do WhatsApp Cloud API — **número de teste brasileiro** |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | *[pending]* | `.env.local` | WABA ID da Conta de Negócios WhatsApp — **pendente de cadastro no Meta** |
| `WHATSAPP_ACCESS_TOKEN` | `EAAPzgGhNeLgBS6PcDJ9WZCJBN9KAirlyGYkUIA91lYbTAZAIX1Q1XF5nCTa6ehybrLSosaUtWTsok6KoA45GTjMdcU7poH1F776BnZAvOvaeyHAFqGF1v2EZBTrEkZCpbKQwZABw2Y5tWFcCZBHLQVKZCK6xjZBxwbYiavxrAj87cKHxZBXZCOiFue4sWrG62yYvkLKKWyuBqvKZBugioR1M4wmUGDCceXwzWZCNCABVla4x2hZBd4GbAb5D0wLYZBuDZAd9hMjeClRZCHKZBm5OZAyflXPI18v` | `.env.local` | Access Token permanente do WhatsApp Cloud API — **token permanente recebido** |

### 📋 IDs Adicionais do Meta (capturado no painel)

| Identificador | Valor | Observação |
|--------------|-------|------------|
| Account ID (Mensagem 1) | `1372737511600959` | ID de conta de mensagem no Meta |
| Account ID (Mensagem 2) | `1584265412892377` | ID de conta de mensagem no Meta |
| Phone Number ID (Teste EUA) | `1374332299099890` | Phone Number ID de teste (EUA +1 711-742-6402) |

---

## ⚠️ Itens Críticos Identificados

1. **JWT_SECRET** em `.env.local` já foi girado — valor real de 64 hex chars ✅
2. **META_WEBHOOK_VERIFY_TOKEN** consistente entre `.env.example` e `.env.local` ✅
3. **CRON_SECRET** adicionado ao `.env.local` ✅
4. **NEXT_PUBLIC_SITE_URL** adicionado em ambos ✅
5. **WhatsApp Cloud API** — credenciais capturadas do painel Meta:
   - `WHATSAPP_PHONE_NUMBER_ID` = `+55 11 91734-5249` (número brasileiro de teste)
   - `WHATSAPP_BUSINESS_ACCOUNT_ID` — pendente de cadastro no Meta
   - `WHATSAPP_ACCESS_TOKEN` = `EAAP...` (token permanente recebido)
   - IDs adicionais: `1372737511600959`, `1584265412892377`, `1374332299099890`

## 🛠️ Próximas Ações Necessárias

1. **🔄 Em andamento**: Cadastrar número de telefone no Meta Painel
   - Número de teste: `+55 11 91734-5249` já registrado em .env.local
   - Phone Number ID: `+55 11 91734-5249` (valor no .env)
   - Necessário confirmar cadastro no painel Meta e associar ao WABA

2. **🔄 Pendente**: Configurar Webhook no Meta Painel
   - Callback URL: `https://revolutionx.com.br/api/webhooks/meta`
   - Verify token: `0b1e361df76b89b0e1f2985d830fe6d5`
   - Subscrever fields: messages, message_status, message_template_status_update

3. **🔄 Pendente**: Gerar Access Token permanente no Meta (Business Settings -> System Users, permissões: `whatsapp_business_messaging + whatsapp_business_management`) — **Já temos o token**: `EAAPzgGhNeLgBS6PcDJ9WZCJBN9KAirlyGYkUIA91lYbTAZAIX1Q1XF5nCTa6ehybrLSosaUtWTsok6KoA45GTjMdcU7poH1F776BnZAvOvaeyHAFqGF1v2EZBTrEkZCpbKQwZABw2Y5tWFcCZBHLQVKZCK6xjZBxwbYiavxrAj87cKHxZBXZCOiFue4sWrG62yYvkLKKWyuBqvKZBugioR1M4wmUGDCceXwzWZCNCABVla4x2hZBd4GbAb5D0wLYZBuDZAd9hMjeClRZCHKZBm5OZAyflXPI18v`

4. **🔄 Pendente**: Registrar domínio `revolutionx.com.br` em "App Domains" no painel do desenvolvedor Meta (developers.facebook.com/apps/1112157761403064/settings/basic/)

5. **✅ Concluído**: JWT_SECRET girado (de placeholder para valor real)
6. **✅ Concluído**: CRON_SECRET adicionado ao `.env.local`
7. **✅ Concluído**: NEXT_PUBLIC_SITE_URL adicionado em `.env.local` e `.env.example`
8. **✅ Concluído**: META_WEBHOOK_VERIFY_TOKEN consistente entre ambientes
9. **✅ Concluído**: Credenciais do WhatsApp capturadas do painel Meta (IDs e token)
10. **✅ Concluído**: .mcp.json atualizado com credenciais reais

---

*Este arquivo deve ser mantido atualizado na raiz do projeto. Toda credencial nova deve ser adicionada tanto a `.env` (com valor) quanto a `.env.example` (sem valor) e a este `CREDENCIAIS.md`.*