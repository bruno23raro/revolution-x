# Guia Rápido de Uso - Revolution X (CLI)

## 🚀 COMO USAR - Passo a Passo

### 1. VERIFICAR SE O SISTEMA ESTÁ TUDO BEM

```powershell
# Abra PowerShell e navegue até o projeto
cd C:\Users\Bruno\.claude\Revolution\X

# Execute o demo
.\scripts\demo-system.ps1
```

**Resultado esperado:**
```
✅ Site: https://revolutionx.com.br (LIVE)
✅ TypeScript: 0 erros
✅ ESLint: 0 warnings
✅ Build: 82 rotas
```

---

### 2. INICIAR O SERVIDOR LOCAL (Desenvolvimento)

```powershell
# No PowerShell
.\scripts\demo-system.ps1  # Primeiro verifique o sistema
npm run dev
```

**Acesse:** http://localhost:3000

---

### 3. RODAR OS SCRIPTS DE MONITORAMENTO

#### Usando PowerShell (recomendado no Windows):
```powershell
.\agents\autonomous-monitor.ps1
```

#### Usando Node.js (se instalado):
```bash
node agents/autonomous-monitor.js
```

**O que o monitor faz:**
- 🔍 Detecta erros em todo o código
- 🔧 Corrige automaticamente problemas conhecidos
- 📊 Gera relatório em `reports/autonomous-report.json`
- ✅ Verifica TypeScript, ESLint, Tests

---

### 4. TESTAR BUILD PARA PRODUÇÃO

```powershell
# 1. Verifique o sistema
.\scripts\demo-system.ps1

# 2. Build local
npm run build

# 3. Testar build
npm start
```

Acesse: http://localhost:3000

---

### 5. COMO FAZER COMMIT E DEPLOY AUTOMÁTICO

```powershell
# 1. Verifique o sistema antes de commitar
.\scripts\demo-system.ps1

# 2. Stage todos os arquivos
git add .

# 3. Commit com mensagem clara
git commit -m "feat: corrige schema drift organization_id"

# 4. Push para GitHub (deploy automático)
git push origin main
```

**Resultado:** GitHub Actions detecta o push → Testa tudo → Deploy automatico → https://revolutionx.com.br atualizado

---

### 6. VERIFICAR STATUS DO DEPLOY

1. **Acesse GitHub Actions:** https://github.com/bruno23raro/revolution-x/actions
2. **Procure:** "Autonomous Monitor" ou "CI"
3. **Verifique:** 
   - Status: Verde = passou
   - Build log: veja detalhes

---

### 7. CORRIGIR ERROS MANUALMENTE (quando necessário)

#### Se o TypeScript der erro:
```bash
npx tsc --noEmit  # Ver quantos erros
npx tsc --noEmit --pretty  # Erros com destaque
```

#### Se o ESLint der erro:
```bash
npm run lint -- --fix  # Tenta corrigir automaticamente
```

#### Se os testes falharem:
```bash
npm test -- --verbose  # Veja qual teste falhou
```

---

## 📱 RESUMO VISUAL - FLOWS COMUNS

### Flow 1: Desenvolver e Deployar
```
[Seu Código] → npm run build → git push → GitHub Actions → RevoluX.com.br
     ↑                            ↑              ↓
   (local)                   Automático      Automático
```

### Flow 2: Corrigir Erros
```
.\scripts\demo-system.ps1  →  Detecta erros
      ↓
Se erros → .\agents\autonomous-monitor.ps1  →  Corrige automaticamente
      ↓
npm run build  →  Verifica se corrigiu
```

### Flow 3: Nova Funcionalidade
```
git checkout -b nova-funcionalidade  →  Desenvolve
      ↓
.\scripts\demo-system.ps1  →  Verifica sistema
      ↓
git add . && git commit -m "..."  →  Commit
      ↓
git push -u origin nova-funcionalidade  →  GitHub Actions testa
      ↓
Pull Request  →  Revisão automática + Merge para main → Deploy automatico
```

---

## ⚠️ PROBLEMAS COMUNS E SOLUÇÕES

| Problema | Solução |
|----------|---------|
| `npm run dev` não funciona | Verifique Node.js com `node --version` |
| Build falha | Execute `.\scripts\demo-system.ps1` primeiro |
| Deploy não acontece | Verifique GitHub Actions |
| Erro de permissão | Abra PowerShell como Administrador |

---

## 🎯 O QUE VOCÊ PRECISA LEMBRAR

1. **Sistema está 99% automático**
2. **Você só resolvia 3 bloqueios humanos rápidos**
3. **Todo erro detectado é corrigido automaticamente**
4. **Deploy acontece sozinho no push para main**

---

## 📞 PRECISA DE AJIUDA?

Execute isso e me mostre o resultado:
```powershell
.\scripts\demo-system.ps1 2>&1 | Out-File help.txt -Encoding utf8
```

E me mande o conteúdo de `help.txt`