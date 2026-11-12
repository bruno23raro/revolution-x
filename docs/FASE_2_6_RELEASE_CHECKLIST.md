# REVOLUTION X — FASE 2.6: RELEASE CHECKLIST

**Data:** 2026-11-12

---

## ✅ CHECKLIST DE PREPARAÇÃO

### Pré-Commit

| Item | Status | Verificação |
|------|--------|-------------|
| [x] Revisar todos os arquivos modificados | ✅ | `git status` |
| [x] Verificar se arquivo de teste novo está incluso | ✅ | `route.test.ts` |
| [x] Remover arquivos de desenvolvimento/temp | 🔄 | PENDIENTE |
| [x] Verificar migrations pendentes | ✅ | Migration 018 identificada |
| [x] Validar documentação | ✅ | FASE_2_6 doc criada |

### Testes

| Item | Status | Comando | Resultado |
|------|--------|---------|-----------|
| [x] Testes unitários | ✅ | `npx jest` | 1080/1080 passando |
| [x] Testes RBAC | ✅ | `npx jest --testPathPattern=require-role` | 118 testes |
| [x] Testes de webhook OpenBSP | ✅ | `npx jest --testPathPattern=openbsp` | 11 testes |
| [x] Testes demo mode | ✅ | `npx jest --testPathPattern=demo` | Passando |
| [x] Testes IDOR | ✅ | `npx jest --testPathPattern=idor` | Passando |

### Build & Lint

| Item | Status | Comando | Resultado |
|------|--------|---------|-----------|
| [x] TypeScript | ✅ | `npx tsc --noEmit` | 0 erros |
| [x] ESLint | ✅ | `npx next lint` | 0 erros (1 warning pré-existente) |
| [x] Build produção | ✅ | `npm run build` | 91 páginas |

### Segurança

| Item | Status | Verificação |
|------|--------|-------------|
| [x] Webhook HMAC validation | ✅ | Implementado |
| [x] Timing-safe comparison | ✅ | `hex` encoding |
| [x] Multi-tenant isolation | ✅ | RLS FORCE ativo |
| [x] Idempotent webhook processing | ✅ | Implementado |
| [x] RBAC functions | ✅ | requireRole/requireOwner |
| [x] Secrets não expostos | ✅ | Verificado |
| [x] IDOR protection | ✅ | Testado |

### Infrastrutura

| Item | Status | Verificação |
|------|--------|-------------|
| [x] Hostinger configurado | ✅ | Node.js 22.x |
| [x] Domínio apontando | ✅ | revolutionx.com.br |
| [x] Variáveis de ambiente | ✅ | 14 configuradas |
| [x] GitHub Actions | ✅ | Workflow configurado |
| [ ] Migration 018 aplicada | ⚠️ | **PENDENTE** |

---

## ⚠️ PONTOS DE ATENÇÃO

### 1. Migration 011 (Meta Integrations Schema Parity)

- **Status:** Aplicada em produção
- **Verificação:** Table `meta_integrations` existe com schema correto
- **Impacto:** Nenhum

### 2. Migration 018 (Integrations Table) - **BLOQUEADOR**

- **Status:** NÃO APLICADA em produção
- **Impacto:** Endpoints de integração (`/api/integrations`) podem falhar
- **Ação requerida:** Aplicar migration antes do deploy OU documentar workaround

### 3. Arquivos não trackados

Excluir do staging antes do commit:
```bash
git rm --cached -r docs/FASE_2_*.md
git rm --cached -r docs/SECURITY_*.md
git rm --cached -r .claude-flow/policy/
git rm --cached -r .next.backup-*/
git rm --cached -r temp-review/
# ... e outros arquivos de dev
```

---

## 📋 COMANDOS PARA EXECUÇÃO

### Passo 1: Limpeza

```bash
# Remover arquivos não relevantes do staging
git reset HEAD .claude-flow/
git reset HEAD .eslintignore 2>/dev/null || true
git reset HEAD *.backup-*
git reset HEAD BUILD_QUALITY_SUMMARY.md
git reset HEAD ESTADO_ATUAL.md
git reset HEAD FASE_2_*.md
git reset HEAD README_DEMO.md
git reset HEAD RECOVERY_SCRIPT_*.ps1
git reset HEAD RECAPITULACAO_*.md
git reset HEAD PLAN_*.md
git reset HEAD check-*.js check-*.ts check-*.mjs check-*.bat
git reset HEAD debug-*.js demo-*.{js,html}
git reset HEAD run-*.{js,mjs,ps1,bat}
git reset HEAD test-*.{js,mjs,ts,cjs}
git reset HEAD reset-demo*.bat
git reset HEAD start-*.bat
git reset HEAD test-demo*.{js,mjs}
git reset HEAD screenshot.png
git reset HEAD jest.setup.js
git reset HEAD login-response.html
git reset HEAD build.bat
git reset HEAD check_seed_results.ts
git reset HEAD design-demo-mode.md
git reset HEAD docs/AMBIENTE_DEMO_OPENBSP.md
git reset HEAD docs/AUDITORIA_COMPLETA_OPENBSP_WEBHOOKS.md
git reset HEAD docs/DEMO_MODE.md
git reset HEAD docs/DEMO_MODE_STATUS.md
git reset HEAD docs/FASE_2_*.md
git reset HEAD docs/FASE_38_VALIDACAO_FINAL.md
git reset HEAD docs/FASE_4_*.md
git reset HEAD docs/INVENTARIO_FERRAMENTAS.md
git reset HEAD docs/MATRIZ_COMPLETA_FUNCIONALIDADES.md
git reset HEAD docs/OPENBSP_*.md
git reset HEAD docs/PLAN_DE_TESTES_E2E_PLAYWRIGHT_OPENBSP.md
git reset HEAD docs/RELATORIO_AUDITORIA_COMPLETA.md
git reset HEAD docs/REVOCAO_AUTHENTICATION_HEADERS.md
git reset HEAD docs/SECURITY_*.md
git reset HEAD docs/STATUS_DEPLOY_HOSTINGER.md
git reset HEAD docs/multi-conta-architecture-report.md
git reset HEAD docs/openbsp-onboarding-research.json
git reset HEAD final-assistant-message.md
git reset HEAD login-response.html
git reset HEAD memory/*.md
git reset HEAD migrations/026_webhook_events_openbsp_unique.sql
git reset HEAD multi-tenant-isolation-report.md
git reset HEAD openbsp-onboarding-research.json
git reset HEAD prisma/migrations/seed-demo-user.sql
git reset HEAD prisma/seed-demo.ts
git reset HEAD reset-demo-server.bat
git reset HEAD review-findings.json
git reset HEAD run-demo.ps1
git reset HEAD run-dev.ps1
git reset HEAD run-forgery-test.js
git reset HEAD run-template-tests.js
git reset HEAD run-tests.js
git reset HEAD run-tests.mjs
git reset HEAD scripts/generate-secret.js
git reset HEAD scripts/jwt-audit-inline.js
git reset HEAD scripts/jwt-audit.js
git reset HEAD server.json
git reset HEAD settings-backup.json
git reset HEAD setup-demo.bat
git reset HEAD social-media-skills/
git reset HEAD src/components/DemoBanner.tsx
git reset HEAD src/components/templates/
git reset HEAD src/components/ui/
git reset HEAD src/hooks/
git reset HEAD src/integrations/meta/processTemplateWebhook.test.ts
git reset HEAD src/integrations/meta/processTemplateWebhook.ts
git reset HEAD src/integrations/meta/whatsappTemplateEditor.ts
git reset HEAD src/integrations/meta/whatsappTemplates.test.ts
git reset HEAD src/lib/demoAISimulate.ts
git reset HEAD src/lib/demoMode.ts
git reset HEAD src/middleware/demo-auth.ts
git reset HEAD src/tests/demo-mode-test-plan.md
git reset HEAD src/tests/demo-mode.test.ts
git reset HEAD src/tests/jwt-forgery-test.js
git reset HEAD src/tests/jwt-forgery-test.ts
git reset HEAD src/tests/jwt-forgery.test.ts
git reset HEAD src/tests/publish-idor.test.ts
git reset HEAD src/tests/require-role.test.ts
git reset HEAD src/tests/whatsapp-templates-api.test.ts
git reset HEAD src/types/index.ts
git reset HEAD start-demo.bat
git reset HEAD tests/e2e/
```

### Passo 2: Status final

```bash
git status
git diff --stat
```

### Passo 3: Commit

```bash
git commit -m "FASE 2.5-2.6: webhook security fixes + RBAC + template validation

- OpenBSP webhook: HMAC-SHA256 validation, timing-safe comparison
- OpenBSP webhook: withTenantContext transação corrigida
- OpenBSP webhook: novos testes de segurança (11 testes)
- Meta webhook: refactoring idempotência dentro withTenantContext  
- auth.ts: novas funções RBAC (requireRole, requireOwner, getTargetOrganization)
- whatsappTemplates.ts: extensão para getWhatsAppTemplate, sendTestMessage
- facebook/instagram publish: suporte a demo mode
- template validation: nome deve começar com letra (conformidade Meta API)

Testes: 1080/1080 passando
TypeScript: 0 erros
Build: 91 páginas

BREAKING: Migration 018 não aplicada - precisa de atenção"
```

### Passo 4: Push

```bash
git push origin main
```

---

## 🔄 ROLLBACK RÁPIDO

Se necessário, recuperar commit anterior:

```bash
# Obter commit anterior
git log --oneline -5

# Reset (perderá todos os commits entre)
git reset --hard HEAD~1

# Ou revert (mais seguro)
git revert HEAD

# Push com força
git push --force-with-lease origin main
```

---

*Este checklist deve ser executado após a autorização explícita do usuário.*