# Revolution X - Guia do Ambiente de Demostração

## 📋 Visão Geral

Este guia explica como usar o **ambiente de demonstração** (demo mode) do Revolution X para testar funcionalidades sem necessidade de login real ou integrações externas.

**⚠️ IMPORTANTE:** O modo demo só funciona com o stack local (Docker Supabase). NUNCA ative em produção.

## 🚀 Como Começar

### 1. Configurar o Ambiente

Execute o script de setup:

```bat
# No Windows
setup-demo.bat start
```

Ou manualmente, crie `.env.local` com:

```
NODE_ENV=development
RX_DEMO_MODE=1
DEMO_JWT_SECRET=xnvVG9DhngoWFJQevuJ2N487l-BN8Nd7N3wCiMR7SEQ
SUPABASE_URL=http://localhost:54321
DATABASE_URL=postgresql://postgres:rx593ce2@localhost:54321/revolution_x
```

**⚠️ DEMO_JWT_SECRET é obrigatório** - sem ele, o demo-login retorna erro 500. Gere uma nova chave:

```bat
node scripts/generate-secret.js >> .env.local
```

### 2. Iniciar o Supabase Local

```bat
# Se usando Docker (recomendado)
cd supabase-docker
docker compose up -d

# Aguardar inicialização (2-3 minutos)
```

### 3. Executar o Seed de Dados

```bat
npm run db:seed:demo
```

**Opcional:** Execute diretamente:
```bat
npx tsx prisma/seed-demo.ts
```

### 4. Iniciar o Servidor

```bat
npm run dev:demo
```

### 5. Acessar o Sistema

Acesse em seu navegador: `http://localhost:3000/dev`

Clique em **"Entrar no Modo Demo"** para ativar o ambiente.

---

## 👤 Credenciais Demo

| Campo | Valor |
|-------|-------|
| Email | `demo@revolutionx.dev` |
| ID do Usuário | `00000000-0000-0000-0000-000000000001` |
| ID da Organização | `00000000-0000-0000-0000-000000000002` |
| Password | Qualquer um (auth local sem password) |
| Role | `admin` |

---

## 📊 Dados de Exemplo Criados

O seed cria automaticamente estes dados fictícios:

### CRM
- **2 Contatos:** João Silva, Maria Oliveira
- **2 Leads:** com status `imported` e `qualified`
- **1 Deal:** Oportunidade R$ 15.000
- **1 Pipeline:** com 4 estágios (Prospecção, Qualificado, Proposta, Fechado)

### WhatsApp (OpenBSP Mockado)
- **1 Canal:** `openbsp-demo-channel` (status PENDING)
- **1 Template:** `welcome_message` (status APPROVED)
- **1 Mensagem:** de demonstração inbound

### Instagram/Facebook
- **2 Posts:** status `draft` e `pending`

### Campanhas
- **1 Campanha:** `Campanha Demo WhatsApp` (canal manual, sem envio real)
- **1 Recipiente:** contato João Silva

### IA & Relatórios
- **1 Memória de sistema:** mensagem de boas-vindas do modo demo

---

## 🔧 Configurações Específicas

### Abilitar Debug

```bat
# Logs detalhados
DEBUG=revolution:* npm run dev:demo
```

### Resetar Dados

```bat
setup-demo.bat reset
setup-demo.bat start
npm run db:seed:demo
```

### Verificar Seed em Execução

O seed é idempotente - pode ser executado múltiplas vezes sem duplicar dados.

---

## ⚠️ Limitações do Modo Demo

- ✅ Não há integração com provedores reais (Meta, OpenBSP)
- ✅ Webhook não recebe mensagens reais
- ✅ Templates de mensagem são mockados
- ✅ Canal OpenBSP está em status `PENDING` (não conecta a produção)

---

## 🛡️ Segurança

O modo demo possui estas proteções:

1. **Guarda de produção:** `demoModeEnabled()` sempre retorna `false` em `NODE_ENV=production`
2. **Allowlist de hosts:** tokens demo só funcionam apontando para `localhost`, `127.0.0.1` ou `host.docker.internal`
3. **Pinning de identidades:** tokens demo são vinculados a IDs específicos (não podem representar usuários reais)
4. **Expiração:** tokens demo expiram em 24 horas

---

## 🛑 Desativar Modo Demo

Para voltar ao modo normal:

```bat
# Remover .env.local ou alterar:
NODE_ENV=production
# RX_DEMO_MODE não deve estar definido
```

---

## 📞 Suporte

Documentação completa: `docs/AMBIENTE_DEMO_OPENBSP.md`

---

*Revolution X - Plataforma multi-tenant de automação de marketing*