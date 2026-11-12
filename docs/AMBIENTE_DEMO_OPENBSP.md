# Ambiente de Demonstração OpenBSP

## Visão Geral

O sistema já possui infraestrutura de **modo demo** configurada para desenvolvimento e demonstração local sem login real.

## Como Ativar o Modo Demo

1. **Configurar variáveis de ambiente** em `.env.local`:
   ```bash
   NODE_ENV=development
   RX_DEMO_MODE=1
   ```

2. **Acessar a página de demo**:
   - Navegue para `http://localhost:3000/dev`
   - Clique em "Entrar no Modo Demo"

3. **Usar o ambiente**:
   - Dados fictícios são carregados automaticamente
   - WhatsApp simulado com mensagens de exemplo
   - CRM com contatos/leads/funs propostos pré-configurados

## Arquitetura do Modo Demo

### Componentes Principais

| Arquivo | Função |
|---------|--------|
| `src/lib/demoMode.ts` | Detecta e valida modo demo |
| `app/api/dev/demo-login/route.ts` | Endpoint de login demo |
| `app/dev/page.tsx` | Página de ativação demo |
| `prisma/seed-demo.ts` | Seed de dados fictícios |
| `src/tests/demo-mode.test.ts` | Testes de validação |

### Segurança Crítica

⚠️ **O modo demo NUNCA funciona em produção**:
- `demoModeEnabled()` sempre retorna `false` quando `NODE_ENV === 'production'`
- Tabelas `whatsapp_channels` e `whatsapp_templates` requerem dados reais

## Fluxos Suportados

### 1. Autenticação
- Usuário demo: `demo@revolutionx.dev`
- ID: `00000000-0000-0000-0000-000000000001`
- Organização: `00000000-0000-0000-0000-000000000002`
- Role: `admin`

### 2. WhatsApp (OpenBSP)
- **Canal demo**: `demo-verify-token-[timestamp]`
- **Status**: `PENDING` → `CONNECTED` (após onboarding simulado)
- **Mensagens**: Mockadas via `src/integrations/whatsapp/openbsp/client.ts`

### 3. CRM
- **Contatos**: João Silva, Maria Oliveira
- **Leads**: Lead quente com score 85
- **Deals**: Oportunidade de R$ 15.000 em qualification

### 4. Campanhas
- Campanha demo: "Campanha Demo"
- Status: `draft` → `queued` → `running`

### 5. Posts (Instagram/Facebook)
- Post Instagram demo: `post-demo-ig`
- Post Facebook demo: `post-demo-fb`

## Extensão para OpenBSP Real

Quando pronto para produção:

1. Remover `RX_DEMO_MODE=1` das variáveis
2. Executar onboarding real via `/api/integrations/openbsp/connect`
3. Configurar webhook Meta no painel OpenBSP
4. Atualizar dados reais no banco

## Debug

Para verificar se está em modo demo:
```bash
# Verificar variáveis
grep -E "NODE_ENV|RX_DEMO_MODE" .env.local

# Verificar seed
npx prisma studio --preview-feature

# Testar login demo
curl -X POST http://localhost:3000/api/dev/demo-login
```