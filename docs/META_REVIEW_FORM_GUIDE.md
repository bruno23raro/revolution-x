# Formulário de Revisão da Meta — Revolution X

## Respostas Prontas para Copiar e Colar

---

### 1. "Onde podemos encontrar este app?"

**Resposta:**
```
https://revolutionx.com.br
```

---

### 2. "Forneça instruções sobre como acessar o app"

**Resposta:**
```
1. Acesse https://revolutionx.com.br
2. Faça login com: brunoalmeida23111996@gmail.com
3. Navegue até a seção "Integrações" no menu lateral
4. Clique em "Conectar via OAuth" no cartão Meta
5. Autorize as permissões solicitadas pelo Facebook/Instagram
6. Após autorização, você será redirecionado de volta ao app
7. Verifique se a integração aparece como "Conectado" na seção de integrações

O app permite conectar múltiplas contas do Meta (Facebook Pages, Instagram Business, WhatsApp Business) para gerenciamento centralizado de publicações.
```

---

### 3. "Confirmação de uso das APIs da Meta"

**Resposta:**
```
Nosso aplicativo utiliza as seguintes APIs da Meta:

1. Facebook Graph API v26.0:
   - pages_show_list: Listar páginas do Facebook conectadas
   - pages_manage_posts: Publicar conteúdo nas páginas conectadas
   - pages_read_engagement: Ler métricas de engajamento das páginas
   - pages_manage_ads: Criar e gerenciar anúncios nas páginas conectadas
   - ads_read: Ler insights e relatórios de campanhas de anúncios

2. Instagram Graph API:
   - instagram_basic: Obter informações básicas do perfil Instagram
   - instagram_content_publish: Publicar imagens e vídeos no Instagram

3. Meta Business SDK:
   - business_management: Gerenciar múltiplos negócios e conexões

4. WhatsApp Business API:
   - whatsapp_business_messaging: Enviar e receber mensagens via WhatsApp Business

Todos os access tokens são armazenados de forma segura com criptografia AES-256-GCM e renovados automaticamente antes do vencimento. O app segue as diretrizes de uso de dados da Meta e não realiza nenhuma ação sem autorização explícita do usuário.
```

---

### 4. "O Login do Facebook está integrado a esta plataforma?"

**Marque:** ✅ **Sim**

**Explicação adicional (se houver campo de texto):**
```
Sim, o app utiliza Facebook Login (OAuth 2.0) para autenticação dos usuários. O fluxo é gerenciado pelo Supabase Auth, que integra com provedores OAuth incluindo Facebook e Google.

Usuários podem fazer login usando:
- Email/senha (autenticação nativa do app)
- Facebook Login (OAuth 2.0)
- Google Login (OAuth 2.0)

O callback OAuth é processado em: https://revolutionx.com.br/api/auth/callback/meta
```

---

### 5. "Credenciais de teste"

**Resposta:**
```
Email: brunoalmeida23111996@gmail.com
Senha: [MANTENHA SECRETO]

Ou utilize Facebook Login para testar a integração OAuth.
```

⚠️ **IMPORTANTE:** Não compartilhe a senha publicamente. A Meta pode solicitar acesso às credenciais por mensagem privada no sistema de revisão.

---

### 6. "Códigos de presente"

**Marque:** ❌ **Não se aplica**

**Explicação:** Revolution X é uma plataforma SaaS de gerenciamento de conteúdo para redes sociais. Não vendemos produtos físicos nem oferecemos códigos de presente. Os usuários assinam planos mensais/anuais para acesso à plataforma.

---

### 7. "Restrições geográficas"

**Marque:** ❌ **Nenhuma restrição**

**Explicação adicional:**
```
O app está disponível globalmente sem restrições geográficas. Suporta:

- Idioma: Português (Brasil) como padrão, com suporte a inglês
- Fuso horário: Configurável por usuário
- Pagamentos: aceita cartão de crédito internacional e PIX (Brasil)

Nenhuma restrição de IP ou geolocalização foi implementada.
```

---

## Resumo Rápido

| Campo | Resposta |
|-------|----------|
| URL do App | `https://revolutionx.com.br` |
| Credenciais de Teste | `brunoalmeida23111996@gmail.com` |
| Login Facebook | Sim, via OAuth 2.0 |
| Códigos de Presente | Não se aplica |
| Restrições Geográficas | Nenhuma |

---

## Como Preencher no Developer Portal

1. Acesse: https://developers.facebook.com/apps/1112157761403064/
2. No menu lateral esquerdo, clique em **"Quality Review"** (Revisão de Qualidade)
3. Selecione os produtos que deseja revisar:
   - ✅ Facebook Login
   - ✅ Instagram Graph API
   - ✅ WhatsApp Business API
4. Clique em **"Submit for Review"** (Enviar para Revisão) no canto superior direito
5. Preencha cada campo usando as respostas acima
6. Aguarde a resposta da Meta (normalmente 24-72 horas)

---

## Passo a Passo Detalhado

### Passo 1 — Acessar o Developer Portal
```
https://developers.facebook.com/apps/1112157761403064/settings/basic/
```

### Passo 2 — Ir para Quality Review
No menu lateral esquerdo, clique em **"Quality Review"**.

Se não aparecer, vá em:
- **"App Review"** → **"Quality Review"**

### Passo 3 — Selecionar Produtos
Você verá os produtos configurados no seu app:

| Produto | Status | Ação |
|---------|--------|------|
| Facebook Login | Configurado | ✅ Selecionar |
| Instagram Graph API | Configurado | ✅ Selecionar |
| WhatsApp Business API | Configurado | ✅ Selecionar |
| Marketing API | (opcional) | ⬜ Selecionar se usar |

### Passo 4 — Submeter para Revisão
Clique no botão **"Submit for Review"** no canto superior direito.

### Passo 5 — Preencher o Formulário
O formulário abrirá com os campos listados acima. Copie e cole as respostas prontas.

### Passo 6 — Aguardar Resposta
- **Tempo médio:** 24-72 horas úteis
- **Notificação:** Email para o admin do app
- **Status:** Pode ser visto em **"Quality Review"** > **"Review Status"**

---

## Troubleshooting Comum

### Erro: "App in Development Mode"
- **Solução:** Vá em Configurações > Básico e ative o modo **"Ao Vivo"**
- Ou adicione testadores em Configurações > Papéis

### Erro: "redirect_uri não corresponde"
- **Solução:** Verifique em Facebook Login > Configurações se a URI `https://revolutionx.com.br/api/auth/callback/meta` está registrada

### Revisão Reprovada
- Leia o motivo no email da Meta
- Ajuste conforme solicitado
- Reenvie para revisão

### Status "Em Análise" demora
- Isso é normal. A Meta revisa manualmente.
- Não submeta novamente antes do prazo — isso reinicia a fila.

---

## Próximos Passos Após Aprovação

1. ✅ App estará disponível para todos os usuários
2. ✅ Nova integração OAuth funcionará para qualquer usuário
3. ✅ Webhook do WhatsApp receberá eventos em tempo real
4. ✅ Instagram permitirá publicações automatizadas
