# Bloqueio do Token System User Meta — Guia para o Humano

## 1. O Problema

- O app `1421814643397349` (CAPI) retorna erro 101 ao usar o secret conhecido `ff2edcdec00e1e843433b860c717a3ab`.
- Este secret pertence ao app `1112157761403064`, não ao CAPI.
- A variável `SYSTEM_USER_TOKEN` em `.env.local` é um token de aplicativo, não de usuário do sistema.

## 2. Passos Exatos no Meta Console (≈5 minutos)

1. **Acesse**: https://developers.facebook.com/
2. **Encontre o app**: `1421814643397349`
   - Se não existir, crie um novo app Meta (ou use `1112157761403064` como alternativa).
3. **Configurações → Básicas**:
   - Localize **App Secret**.
   - Se for o secret errado, gere um novo.
   - Ative **Mostrar App Secret** se necessário.
4. **Configurações → Avançadas**:
   - Confirme as permissões do app.
5. **Configurações → Negócios → Usuários do Sistema**:
   - Crie um novo Usuário do Sistema (ou use um existente) com nome "Revolution X".
   - Atribua ao app com papel **Admin**.
6. **Gerar Token**:
   - Escolha **Gerar um novo token de acesso do usuário do sistema**.
   - Marque as permissões:
     - `ads_management`
     - `ads_read`
     - `pages_read_user_content` (se disponível)
     - `pages_show_list` (se disponível)
   - Copie o token gerado.
7. **Atualize arquivos**:
   - Adicione ao `.env.local`:
     ```
     META_SYSTEM_USER_TOKEN_1421814643397349=<TOKEN_COPIADO>
     ```
   - Atualize `plan_meta_system_user.md` com o token mascarado (primeiros 8 + últimos 4).

## 3. Caminho Alternativo (se o app 1421814643397349 não for acessível)

- Use o app `1112157761403064`.
- Crie um Usuário do Sistema nele.
- Gere token com permissões `ads_management` + `ads_read`.
- Salve como `META_SYSTEM_USER_TOKEN_1112157761403064`.

## 4. Validação

- Execute `meta auth status` no terminal.
- Verifique se o token funciona nas chamadas Graph API.

---

*Execute este guia e reporte de volta com o token gerado (mascarado).*