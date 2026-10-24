# Formulário de Revisão da Meta — Revolution X

## Como Preencher Cada Campo

---

### Campo 1: "Onde podemos encontrar este app?"

**Preencha com:**
```
https://revolutionx.com.br
```

**Explicação:** Esta é a URL pública do seu aplicativo. A Meta precisa verificar se o app é funcional e acessível.

---

### Campo 2: "Forneça instruções sobre como acessar o app"

**Preencha com:**
```
1. Acesse https://revolutionx.com.br
2. Faça login com as credenciais de teste fornecidas abaixo
3. Navegue até a seção "Integrações" no menu lateral
4. Clique em "Conectar via OAuth" na tarjeta Meta
5. Autorize as permissões solicitadas pelo Facebook/Instagram
6. Após autorização, você será redirecionado de volta ao app
7. Verifique se a integração aparece como "Conectado" na seção de integrações

O app permite conectar múltiplas contas do Meta (Facebook Pages, Instagram Business, WhatsApp Business) para gerenciamento centralizado de publicações.
```

---

### Campo 3: "Confirmação de uso das APIs da Meta"

**Preencha com:**
```
Nosso aplicativo utiliza as seguintes APIs da Meta:

1. Facebook Graph API v26.0:
   - pages_show_list: Listar páginas do Facebook conectadas
   - pages_manage_posts: Publicar conteúdo nas páginas conectadas
   - pages_read_engagement: Ler métricas de engajamento das páginas

2. Instagram Graph API:
   - instagram_basic: Obter informações básicas do perfil Instagram
   - instagram_content_publish: Publicar imagens e vídeos no Instagram

3. Meta Business SDK:
   - business_management: Gerenciar múltiplos negócios e conexões

Todos os access tokens são armazenados de forma segura com criptografia AES-256-GCM e renovados automaticamente antes do vencimento. O app segue as diretrizes de uso de dados da Meta e não realiza nenhuma ação sem autorização explícita do usuário.
```

---

### Campo 4: "O Login do Facebook está integrado a esta plataforma?"

**Marque:** ✅ **Sim**

**Preencha adicionalmente (se houver campo de texto):**
```
Sim, o app utiliza Facebook Login (OAuth 2.0) para autenticação dos usuários. O fluxo é gerenciado pelo Supabase Auth, que integra com provedores OAuth incluindo Facebook e Google.

Usuários podem fazer login usando:
- Email/senha (autenticação nativa do app)
- Facebook Login (OAuth 2.0)
- Google Login (OAuth 2.0)

O callback OAuth é processado em: https://revolutionx.com.br/api/auth/callback/meta
```

---

### Campo 5: "Credenciais de teste"

**Preencha com:**
```
Email: brunoalmeida23111996@gmail.com
Senha: [MANTENHA SECRETO]

Ou utilize Facebook Login para testar a integração OAuth.
```

⚠️ **IMPORTANTE:** Não compartilhe a senha publicamente. A Meta pode solicitar acesso às credenciais por mensagem privada no sistema de revisão.

---

### Campo 6: "Códigos de presente"

**Marque:** ❌ **Não se aplica**

**Explicação:** Revolution X é uma plataforma SaaS de gerenciamento de conteúdo para redes sociais. Não vendemos produtos físicos nem oferecemos códigos de presente. Os usuários assinam planos mensais/anuais para acesso à plataforma.

---

### Campo 7: "Restrições geográficas"

**Marque:** ❌ **Nenhuma restrição**

**Preencha adicionalmente (se houver campo de texto):**
```
O app está disponível globalmente sem restrições geográficas. Suporta:

- Idioma: Português (Brasil) como padrão, com suporte a inglês
- Fuso horário: Configurável por usuário
- Pagamentos:aceita cartão de crédito internacional e PIX (Brasil)

Nenhuma restrição de IP ou geolocalização foi implementada.
```

---

## Passo a Passo no Developer Portal da Meta

### 1. Acessar as Configurações do App

```
https://developers.facebook.com/apps/1112157761403064/settings/
```

### 2. Ir para "Quality Review" (Revisão de Qualidade)

No menu lateral esquerdo, clique em **"Quality Review"**

### 3. Selecionar os Produtos para Revisão

Você verá uma lista de produtos configurados:
- ✅ Facebook Login
- ✅ Instagram Graph API  
- ✅ WhatsApp Business API

Selecione todos que deseja submeter para revisão.

### 4. Clicar em "Submit for Review"

Após selecionar os produtos, clique no botão **"Submit for Review"** no canto superior direito.

### 5. Preencher o Formulário

O formulário abrirá com os campos listados acima. Copie e cole as respostas preparadas.

---

## Próximos Passos Após Envio

1. **Aguarde a confirmação** — A Meta geralmente responde em 24-72 horas
2. **Verifique seu email** — Você receberá um email com o status da revisão
3. **Responda perguntas adicionais** — Se a Meta solicitar informações extras, responda prontamente
4. **Acompanhe no Dashboard** — O status pode ser visto em "Quality Review" > "Review Status"

---

## Troubleshooting Comum

### Erro: "redirect_uri não corresponde"
- Certifique-se de que `https://revolutionx.com.br/api/auth/callback/meta` está em **OAuth Redirect URIs** nas configurações do app

### Erro: "App in Development Mode"
- Ative o modo **Live** em Configurações > Básico
- Ou adicione testadores em Configurações > Papéis

### Revisão Reprovada
- Leia o motivo no email da Meta
- Ajuste conforme solicitado
- Reenvie para revisão

---

## Resumo Rápido para Copiar e Colar

| Campo | Resposta |
|-------|----------|
| URL do App | `https://revolutionx.com.br` |
| Credenciais de Teste | `brunoalmeida23111996@gmail.com` |
| Login Facebook | Sim, via OAuth 2.0 |
| Códigos de Presente | Não se aplica |
| Restrições Geográficas | Nenhuma |
