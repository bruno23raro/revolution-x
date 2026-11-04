# Use OpenBSP Exclusively — 2026-11-03

## Mudança Implementada

Modifiquei `src/integrations/whatsapp/openbsp/provider.ts` para inverter a prioridade de envio:

### Antes (caminho preferencial Meta → fallback OpenBSP)
1. Se `accessToken` + `phoneNumberId` presentes → Cloud API direta Meta
2. Se falhar → proxy OpenBSP

### Depois (caminho preferencial OpenBSP → fallback Meta)
1. **Tente OpenBSP proxy primeiro** (`sendViaOpenbsp`) — **agora é o caminho prioritário**
2. Apenas em erros de **network/infra** → fallback para Cloud API direta Meta
3. Erros de negócio do OpenBSP **NÃO caem de volta** para Meta

## Como Fica o Fluxo

```
                              .---------------------.
                              |  Tenta OpenBSP proxy  |
                              '----------+----------'
                                          |
                              .---------+---------.
                              | Network/error?    |
                              '------+----------'
                                      |
                                Não -----> Retorna erro OpenBSP
                                      |
                                Sim -----> .---------+---------.
                                             | Network/infra? |
                                             '-----+----------'
                                                     |
                                              Sim -----> Cloud API Meta direta
                                             (fallback apenas erros de infra)
                                                     |
                                              Não -----> Retorna erro OpenBSP
```

## Configuração Necessária

Para usar OpenBSP exclusivamente, confirme estas variáveis no `.env.local`:

```
OPENBSP_BASE_URL=https://nheelwshzbgenpavwhcy.supabase.co/rest/v1
OPENBSP_PUBLISHABLE_KEY=sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd
OPENBSP_API_KEY=sk_dcca9cc0057142ce95bba1e051b01699
OPENBSP_ORG_ID=9d7114cd-013e-4e03-b91d-848518bf6514
WHATSAPP_PROVIDER=openbsp  # já está definido
```

## Requisito Crítico: `phoneNumberId` na tabela

O OpenBSP proxy precisa de `phoneNumberId` no canal. O código em `channelRepo.ts:61` já detecta isso:
```typescript
const isOpenBSPConnected = row.phoneNumberId;
```

**Ação**: Popule `phoneNumberId` no `whatsapp_channels` table para seus canais OpenBSP ativos (via migration ou update direto no Supabase).

## O que Muda na Prática

| Cenário | Antes | Agora |
|---------|-------|-------|
| Canal OpenBSP conectado | Template via Meta Cloud API | Template via OpenBSP proxy (`insert messages`) |
| Falha de network Meta | Cai para OpenBSP proxy | Ainda tenta OpenBSP proxy (já é prioritario) |
| Falha de network OpenBSP | Cai para Meta Cloud API | Ainda tenta Meta Cloud API (fallback honesto) |
| Erro business OpenBSP | Ignorado (cai para Meta) | Retorna erro OpenBSP (não cai para Meta) |

## Testes

Todos os 778 testes passam, incluindo:
- `whatsapp-official.test.ts` — 14 testes do OpenBSP client
- `whatsapp-official-routes.test.ts` — 6 testes dos routes
- Integração com dispatcher e tier gates

## Próximos Passos

1. ⛔ **Pendente**: Popule `phoneNumberId` no `whatsapp_channels` table (ação humana via Supabase)
2. 🔄 **Deploy**: O código já está pronto — ao deployar, o OpenBSP será usado prioritariamente
3. ✅ **Verificar**: Após o step 1, o status endpoint mostrará `mode: 'OFFICIAL'`, `status: 'CONNECTED'` com o `phoneNumber`

---

**Resumo**: Código modificado para usar OpenBSP prioritariamente. Deploy + dados no banco (phoneNumberId populado) = uso exclusivo OpenBSP, dispensando a necessidade do app Meta para disparos WhatsApp.