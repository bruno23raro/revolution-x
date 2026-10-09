# REVOLUTION X — MEMÓRIA PERSISTENTE

## PALAVRA-CHAVE DE RECUPERAÇÃO

REVOLVER

## REGRA PRINCIPAL

Checkpoint persistente. Não inventar. Não expor secrets.

## ESTADO ATUAL

- Build Hostinger `01a11d99` (commit `e45ac49`): **PASS**
- Página de login funcional: **PASS**
- Supabase Auth: **BLOCKED** — GoTrue retorna 500/Invalid credentials.
- Isolamento multi-tenant: **NOT TESTED** (depende de Auth).
- Meta/WhatsApp webhook: **BLOCKED** (placeholder).

## DIAGNÓSTICO SUPABASE AUTH

- `auth.users` tem RLS habilitado com 0 políticas.
- GoTrue falha ao consultar schema (`Database error querying schema`).
- Inserções SQL manuais para contornar auth estão sendo bloqueadas ou falhando (GoTrue não reconhece bcrypt comum, precisa `crypt()`).
- Requer intervenção administrativa no Dashboard para configurar `auth.users` ou corrigir GoTrue.

## PENDÊNCIAS

1. **Supabase Auth**: Corrigir configuração no Dashboard (Authentication -> Settings -> Email ou RLS policies).
2. **Meta/WhatsApp Webhooks**: Restaurar valores reais de variáveis no Hostinger.
3. **Validação**: Testar login em produção e validar isolamento multi-tenant.
