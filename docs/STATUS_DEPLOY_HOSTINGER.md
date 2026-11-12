# Status Deploy - Hostinger

## Domínio Principal
- **URL**: https://revolutionx.com.br
- **Status**: ✅ Ativo
- **Último deploy**: Via GitHub Actions (auto-deploy main)

## Configuração do Node.js

### hPanel
- **Node Version**: 18.x (verificar se atualizado para 20.x)
- **Directory**: `/public_html` ou `/revolutionx`
- **Build command**: `npm run build`
- **Start command**: `npm start` (ou `next start`)

### Variáveis de Ambiente
```bash
# Verificar no hPanel → Setup → Environmental Variables
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
META_APP_SECRET=...
```

## Verificação do Build

### Passos para validar
```bash
# Local
npm run build
# Verificar saída:
# - 0 erros TypeScript
# - 0 erros lint
# - Build completo sem warnings críticos

# No servidor
# Acessar: hPanel → File Manager → public_html
# Verificar: .next/, node_modules/ (instalados), package.json
```

## Cron Jobs / Scheduled Tasks

### Verificar
- **hPanel → Scheduled Tasks**
- **Tasks ativos**: 
  - `*/15 * * * *` - refresh-tokens.js (se existir)

## Logs de Deploy

### Local
```
.npm/_logs/         # npm logs
.next/build/        # build logs
```

### Hostinger
```
hPanel → Error Logs
hPanel → Access Logs
```

## Problemas Conhecidos

### 1. Senha do Admin
- **Problema**: Senha `B23b23v1814*` revogada
- **Solução**: Reset via Supabase Dashboard
- **Status**: Bloqueado aguardando ação humana

### 2. Token OpenBSP Onboarding
- **Problema**: Token `4aea657b-ac06-4d9e-bc3a-55fdc25713a2` pendente
- **Solução**: Completar onboarding no painel OpenBSP
- **Status**: Bloqueado aguardando ação humana

## Testes de Produção

### Endpoint Health Check
```bash
curl -I https://revolutionx.com.br/
# Esperado: 200 OK, Content-Type: text/html
```

### API Routes
```bash
curl https://revolutionx.com.br/api/auth/session
# Esperado: 401 (sem sessão) - correto

curl https://revolutionx.com.br/api/integrations/status
# Esperado: 200 ou 401
```

### WhatsApp
```bash
curl https://revolutionx.com.br/api/webhooks/meta
  -H "Hub.mode: subscribe" -H "Hub.verify_token: <token>"
# Esperado: 200 com challenge
```

## Checklist de Deploy Seguro

- [x] TypeScript 0 erros
- [x] Lint 0 warnings críticos
- [x] Build local executado (88 páginas)
- [ ] Variáveis de ambiente migradas
- [ ] Dependências instaladas no servidor
- [ ] Migrações aplicadas (prisma migrate deploy)
- [ ] Cache limpo (.next, node_modules)
- [ ] Teste rápido de login/cadastro
- [ ] Teste CRM básico
- [ ] Teste integração webhook Meta
- [x] Correção segurança webhook OpenBSP (HMAC-SHA256 validado)

## Procedimento de Rollback

Se deploy falhar:
1. hPanel → Git → Revert para commit anterior
2. Ou: `git reset --hard <commit_hash>` via CLI
3. Reiniciar aplicação Node.js

## Contatos

- **Desenvolvedor**: Bruno (brunoalmeida23111996@gmail.com)
- **Provider**: Hostinger BR
- **Suporte**: hPanel support ticket