# RX — Contrato OpenBSP (PASSO B)

Fontes (clonadas FORA do repo, `C:\tmp\openbsp-ref\`, lidas 2026-10-29):
`open-bsp-api/INTEGRATING.md`, `AUTH.md`, `MIGRATING_FROM_TWILIO.md`,
`supabase/schemas/03_models/03-11_onboarding_tokens.sql`, `03-01_organizations_addresses.sql`,
`supabase/functions/whatsapp-management/templates.ts` (v24.0), `open-bsp-ui/.env.example`.

## Base e autenticação

- Base REST: `https://nheelwshzbgenpavwhcy.supabase.co/rest/v1/<table>` (PostgREST).
- **SEMPRE dois headers**: `apikey: <publishable>` + `api-key: <OPENBSP_API_KEY>`.
  **NUNCA** `Authorization: Bearer <api-key>` (PostgREST rejeita PGRST301 — não é JWT).
- Publishable (pública, embutida no bundle do site — confirmada no bundle `useTranslation-*.js` de web.openbsp.dev): `sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd`.
- Edge functions: `POST /functions/v1/<fn>` com `Authorization: Bearer <OPENBSP_API_KEY>` (sem apikey).
- Papéis de chave: **owner** (mina onboarding_tokens; exige `organization_id` = org da chave, senão RLS 42501), **admin** (templates/contatos/webhooks/envio), **member** (leitura+envio).

## Onboarding por tenant (fluxo que vamos montar)

1. `POST /rest/v1/onboarding_tokens?select=id` (chave **owner**, `Prefer: return=representation`)
   body: `{ name, organization_id, service:"whatsapp", expires_at, callback_url:"https://revolutionx.com.br/api/integrations/openbsp/incoming?org=<uuid>", verify_token:"<random por tenant>" }`
2. Popup do tenant: `https://web.openbsp.dev/onboard/whatsapp/<id>` (Embedded Signup; cliente não precisa de conta OpenBSP nem app Meta).
3. Sucesso: token vira `used`; aparece linha em `organizations_addresses` (`status=connected`) com
   `extra = { waba_id, access_token, phone_number, verified_name, callback_url, verify_token }`.
4. **Correlação tenant↔canal: pelo `extra.verify_token`/`extra.callback_url`** (o id do token NÃO vem na linha). Por isso mint único por tenant (já previsto no plano).
5. Credenciais chegam pelo PLANO OpenBSP (webhook `organizations_addresses` insert/update, payload `{entity,action,data:<row>}` com `Authorization: Bearer <token>` que setarmos) OU polling `organizations_addresses?service=eq.whatsapp&status=eq.connected`.

## Recebimento (importante — corrige expectativa do prompt)

Com `callback_url` definido no token, **é a META que chama o nosso URL diretamente** (padrão webhook Meta: verificação `hub.challenge` ecoando `hub.verify_token`, payloads `entry[].changes[].value` com `phone_number_id`, sem credenciais). O OpenBSP **não armazena** essas mensagens. Portanto:
- `GET /api/integrations/openbsp/incoming?org=…` → desafio `hub.mode=subscribe&hub.verify_token` → comparar com verify_token do tenant (const-time) → eco. **403 silencioso** senão bate.
- `POST` mesmo path → payload Cloud API normal; roteamos por `phone_number_id → whatsapp_channels`; defesa replay via idempotência `wamid` (tabela `webhook_events`/equivalente já cobre).
- Eventos de CONTA (connect/disconnect/erros) vêm do OpenBSP (webhook `organizations_addresses` com nosso token compartilhado, ou polling).

## Envio

- **Via OpenBSP (fallback)**: `POST /rest/v1/messages`
  `{ organization_id, organization_address:<phone_number_id>, conversation_address:<E164 sem +>, service:"whatsapp", content:{version:"1",type:"text",kind:"text",text} }`
  → linha retornada; status no JSONB `status` (`pending→sent→delivered→read` ou `failed` + `errors:[{code,title}]`). Erros Meta async (ex.: 131047 = fora janela 24h/re-engagement).
  Template: `content:{version:"1",type:"data",kind:"template",data:{name,language:{code},parameters:[{type:"text",text}]}}`.
- **Direto Meta (preferido)**: `extra.access_token` do canal + `phone_number_id` → Cloud API v23.0 `POST /<phone_number_id>/messages` com `Authorization: Bearer <token>` (mesmo código de `whatsappSender.ts`).

## Templates

OpenBSP expõe `/functions/v1/whatsapp-management/templates` (GET list / POST create / etc., Bearer = api-key); por dentro é Graph `/{waba_id}/message_templates` (OpenBSP usa v24.0; nós usamos env `WHATSAPP_GRAPH_API_VERSION=v23.0` no caminho direto — compatível). Lifecycle PENDING→poll→APPROVED/REJECTED; envio em massa só com APPROVED. `allow_category_change:true` no create.

## Webhooks de status de envio (opcional, depois)

`POST /rest/v1/webhooks { table_name:"messages", operations:["update"], url, token }` → push de `status` por mensagem. Para MVP: polling da linha `messages?id=eq.<id>&select=status`.

## Limites do free plan (dashboard OpenBSP)

3 números, 5000 msgs/mês (banner honesto na UI). Tiers Meta por número (250/24h em número novo) valem nos DOIS caminhos de envio — enforcing é nosso (PASSO E).

## O que NÃO vi (honesto)

- Contrato exato (request/response) de `whatsapp-management/templates` além do código Deno lido; OpenAPI do repo só documenta `/webhooks`.
- Portal: criar org + API key **owner** exige login Google/GitHub → **pausa humana única** (gate de credencial inexistente).
- Quota exata/contador do plano free (fica no dashboard).
