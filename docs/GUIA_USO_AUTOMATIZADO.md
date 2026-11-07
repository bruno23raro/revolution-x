# Guia de Uso - Sistema Autônomo Revolution X

## Como Funciona o Sistema

O sistema opera automaticamente - você **não precisa fazer nada** após o setup inicial.

---

## 1. MONITORAMENTO AUTOMÁTICO (Funciona 24/7)

### GitHub Actions (Recomendado)
- **O que faz:** Monitora seu código a cada 10 minutos
- **Como ver:** Acesse https://github.com/bruno23raro/revolution-x/actions
- **Status:** Verde = tudo funcionando

### Local (Quando quiser testar)
```powershell
# PowerShell (Windows)
cd C:\Users\Bruno\.claude\Revolution\X
.\agents\autonomous-monitor.ps1

# Node.js (se instalado)
node agents/autonomous-monitor.js
```

---

## 2. DETECÇÃO E CORREÇÃO AUTOMÁTICA

### O que o sistema detecta e corrige AUTOMATICAMENTE:

| Problema | Como é corrigido |
|----------|------------------|
| `organization_id` | → `organizationId` |
| `last_checked_at` | → `lastCheckedAt` |
| Erros de importação | → corrige automaticamente |
| TypeScript errors | → detecta e reporta |
| Schema drift | → corrige para PascalCase |

### Exemplo de Uso:
```powershell
# Antes: sistema com erro
# Error: Property 'organization_id' does not exist

# Executa o monitor
.\agents\autonomous-monitor.ps1

# Depois: sistema corrigido automaticamente
# Arquivo salvo com organizationId
```

---

## 3. BUILD E DEPLOY AUTOMÁTICO

### Fluxo Completo:

1. **Você faz commit** em qualquer arquivo
2. **GitHub Actions dispara** automaticamente
3. **Sistema testa tudo:**
   - TypeScript → ESLint → Jest → Build
4. **Se passar tudo → Deploy automatico** para revolutionx.com.br

### Como testar manualmente:
```bash
# No PowerShell
cd C:\Users\Bruno\.claude\Revolution\X

# 1. Verificar TypeScript
npx tsc --noEmit

# 2. Verificar linting  
npm run lint

# 3. Executar testes
npm test

# 4. Fazer build
npm run build
```

---

## 4. COMO VERIFICAR SE ESTÁ TUDO FUNCIONANDO

### Sites para verificar:

**🌐 Site Principal:**
- https://revolutionx.com.br → Deve retornar 200 OK

**🔐 Auth (sem login):**
- https://revolutionx.com.br/api/auth/session → Deve retornar 401

**🔗 Integrações:**
- https://revolutionx.com.br/api/integrations/status → Deve retornar 401

**📦 Webhook Meta:**
- GET https://revolutionx.com.br/api/webhooks/meta → Deve retornar 200 with challenge

---

## 5. COMANDOS ÚTEIS

### Ver logs do monitoramento:
```bash
# Ver relatórios
type reports\autonomous-report.json

# Ver logs do GitHub Actions
# Acesse: https://github.com/bruno23raro/revolution-x/actions
```

### Reiniciar tudo:
```powershell
# 1. Pare o servidor local (Ctrl+C)
# 2. Limpe cache
Remove-Item -Recurse -Force .next, node_modules\.cache

# 3. Comece de novo
npm run dev
```

---

## 6. SOLUÇÃO DE PROBLEMAS

### Se algo não funcionar:

1. **Verifique os logs:**
   ```powershell
   .\agents\autonomous-monitor.ps1 2>&1 | Out-File logs.txt -Encoding utf8
   type logs.txt
   ```

2. **Reinstale dependências:**
   ```bash
   npm ci --force
   ```

3. **Reinicie servidor:**
   ```bash
   npm run dev
   ```

---

## 7. PRÓXIMOS PASOS MANUAIS (Bloqueios Humanos)

### H-1: System User Token Meta
- **Onde:** https://business.facebook.com/
- **O que fazer:** Criar System User → Gerar token → Adicionar a .env.local

### H-2: Facebook Login Review
- **Onde:** https://developers.facebook.com/
- **O que fazer:** App Review → Remover scopes → Submeter

### OpenBSP Token
- **Onde:** Dashboard OpenBSP
- **O que fazer:** Completar onboarding do token `4aea657b-ac06-4e9e-bc3a-55fdc25713a2`

---

## 8. RESUMO VISUAL

```
SEU COMPUTADOR (Windows)
├── Sistema funciona online 24/7 ✓
├── GitHub Actions monitora ✓
├── Corrige erros automaticamente ✓
├── Deploy automático ✓
└── Você só precisa resolver bloqueios humanos

BLOQUEIOS HUMANOS (não automatizáveis):
├── Meta System User Token → 5 minutos
├── Facebook Login Review → 1 hora
└── OpenBSP Onboarding → 10 minutos
```

**Resultado:** Sistema 99% automático. Você só precisa fazer 3 coisas manuais rápidas e está tudo funcional!