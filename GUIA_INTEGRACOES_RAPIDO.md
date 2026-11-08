# Guia Rápido: Integrações Oficiais (WhatsApp, Instagram, Facebook)

## ✅ Sistema Configurado

Seu código já está **totalmente configurado** para usar as APIs oficiais da Meta.

## 🚀 Como Usar Agora mesmo

### 1. Iniciar o servidor
```bash
npm run dev
# ou
npm start  # em produção
```

### 2. Acessar a tela de integrações
- URL: http://localhost:3000/admin/integrations
- Ou: http://localhost:3000/integracoes

### 3. Conectar cada canal

#### WhatsApp Business
1. Clique em **"Conectar"** ao lado de WhatsApp
2. Será redirecionado para a Meta
3. Selecione a conta empresarial
4. Conceda as permissões necessárias
5. Pronto! Mensagem de sucesso aparecerá

#### Instagram
1. Clique em **"Conectar"** ao lado de Instagram  
2. Faça login no Instagram Business
3. Conceda as permissões
4. Pronto!

#### Facebook
1. Clique em **"Conectar"** ao lado de Facebook
2. Selecione a página
3. Conceda as permissões
4. Pronto!

## 📋 Templates de WhatsApp

Após conectar o WhatsApp, você pode criar templates:

1. Acesse: `/admin/templates`
2. Clique em **"Criar Template"**
3. Preencha:
   - Nome (sem espaços, ex: `order_confirmation`)
   - Categoria: `MARKETING`, `UTILITY` ou `AUTHENTICATION`
   - Corpo: Use `{{1}}`, `{{2}}` para variáveis
4. Envie para aprovação na Meta

## ⚡ Disparo em Massa

Exemplo de uso via API:

```typescript
// POST /api/whatsapp/send
{
  "to": "5511999999999",
  "template": "order_confirmation",
  "variables": ["João", "R$ 99,90"],
  "language": "pt_BR"
}
```

## 🔄 Dual-Path automático

O sistema usa automaticamente:
- **Meta Cloud API direto** → Quando token e phoneNumberId estão configurados
- **OpenBSP (proxy)** → Fallback quando canais não têm credenciais completas

## 📊 Status das credenciais

| Serviço | Status | Onde verificar |
|---------|--------|----------------|
| Meta App ID | ✅ Configurado | `.env.local` |
| OpenBSP | ✅ Configurado | `.env.local` |
| WhatsApp Provider | `openbsp` | `WHATSAPP_PROVIDER` |
| Meta OAuth | Habilitado | `ENABLE_META_OAUTH=true` |

## ⚠️ Sobre o App Review

O **App Review da Meta** é necessário para algumas permissões em produção. 

- **Para uso individual/pessoal**: Não precisa! Funciona via OAuth imediatamente.
- **Para produção comercial**: Precisa da aprovação em `developers.facebook.com`.

### Permissões que funcionam SEM App Review (uso pessoal)
- `instagram_basic`
- `pages_show_list`  
- `pages_messaging`
- `instagram_content_publish`
- `whatsapp_business_messaging`

### Permissões que EXIGEM App Review
- `ads_read` (já está aprovado)
- `instagram_branded_content_ads_brand` (precisa ser removida ou analisada)

## 🆘 Problemas comuns

### "OAuth Error: redirect_uri_mismatch"
✅ Solução: Verifique `NEXT_PUBLIC_SITE_URL` no `.env.local` corresponde ao seu domínio

### "Token expirado"
✅ Solução: Reconecte a integração em `/admin/integrations` - tokens são renovados automaticamente

### "Template não aprovado"
✅ Solução: Crie o template em `/admin/templates` e envie para aprovação na Meta

## 📞 Suporte

- Documentação: `artifacts/RX_WHATSAPP_OFFICIAL_FINAL_REPORT.md`
- Config: `.env.local` (credenciais)
- Código: `src/integrations/meta/`