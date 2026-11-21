# BLOQUEIOS (dependem do provedor)

1. **Domínio JSSDK** — o app Meta `629323992623834` é do OpenBSP e só autoriza `web.openbsp.dev`. O diálogo do Embedded Signup no nosso domínio responde "O domínio do host JSSDK é desconhecido". Mitigação ativa: `popupUrl` abre `web.openbsp.dev`; `/whatsapp/conectar` fica como alternativa.
   Pedido a enviar: incluir `revolutionx.com.br` na lista de domínios do JSSDK do app.
2. **App próprio** (opcional, não bloqueia) — se um dia quiser independência, criar app Meta próprio e incluir em `META_APP_ID`/`META_APP_SECRET` (lista separada por `|`), ajustando `NEXT_PUBLIC_FB_APP_ID`/`NEXT_PUBLIC_FB_CONFIG_ID`.