# Plano de Recuperação e Otimização dos Agentes

## Status Atual
- **Problema:** ENAMETOOLONG uv_spawn - ambiente bloqueado
- **Causa:** `.claude/settings.local.json` com 569+ permissões (~170KB)
- **Limite Windows:** CreateProcessW = 32,767 caracteres
- **Agentes:** 113 arquivos identificados

## FASE 1: Recuperação do Ambiente

### Passo 1.1: Análise das Permissões Problemáticas
Identificar as permissões maiores no `settings.local.json`:
- Procurar por entradas com 200-500+ caracteres cada
- Linhas 144-212, 436-605 sugerem comandos curl complexos
- Comandos com múltiplos headers HTTP

### Passo 1.2: Redução de Permissões (Sem Shell)
Estratégia: Usar Write/Edit direto nos arquivos

1. **Criar backup** do settings.local.json atual
2. **Identificar permissões essenciais:**
   - Bash, Read, Write, Edit, Glob, Grep (necessárias)
   - MCP servers autenticados (Meta, Supabase, Hostinger)
   - Ferramentas críticas de desenvolvimento

3. **Remover permissões redundantes:**
   - Comandos de verificação duplicados
   - Permissões de debug temporárias
   - Comandos curl que podem ser substituídos por MCP

### Passo 1.3: Arquivos Chave a Preservar
```
.claude/settings.json          # Configurações gerais
.claude/settings.local.json   # Permissões (a ser otimizado)
.env.exemplo                    # Templates de variáveis
CLAUDE.md                       # Regras do projeto
```

## FASE 2: Otimização dos Agentes

### Passo 2.1: Análise de Token Usage
Agentes v3 com maiores descrições:
- `security-architect.md` - hooks complexos, description longa
- `v3-integration-architect.md` - description extensa
- `v3-performance-engineer.md` - description detalhada

### Passo 2.2: Estratégia de Otimização
Mover conteúdo das descriptions YAML para o corpo do markdown:

**ANTES (description YAML - limitado):**
```yaml
description: V3 Security Architecture specialist with ReasoningBank learning...
```

**DEPOIS (description YAML - curta):**
```yaml
description: Security architecture with ReasoningBank
```

**E NO CORPO DO ARQUIVO:**
```markdown
# V3 Security Architecture Agent

You are a specialized security architect...

## Capabilities
- Threat modeling
- Vulnerability assessment
...
```

### Passo 2.3: Agentes Prioritários para Otimização
1. V3 agentes com capabilities avançadas
2. Agentes com hooks pre/post complexos
3. Agentes com multi-linha description longa

## FASE 3: Recuperação Gradual

### Passo 3.1: Modo Demonstração
Criar `CLAUSE_DEMO_MODE.md` com instruções para:
1. Usar `.claude/settings.json` (bypass permissions)
2. Desativar configurações locais temporariamente
3. Reativação após correção

### Passo 3.2: Validação
Após recuperação:
- [ ] PowerShell/Teste funcionando
- [ ] TypeScript check passando
- [ ] Testes Jest executando
- [ ] Build Next.js concluído

## Arquivos a Modificar

1. `.claude/settings.local.json` - REDUZIR de 569 para ~50 permissões
2. `.claude/agents/v3/*.md` - AUMENTAR description de `description:` para conteúdo completo no corpo
3. Criar `.claude/settings.local.optimized.json` como backup

## Cronologia Sugerida

| Etapa | Ação | Tempo Estimado |
|-------|------|----------------|
| 1 | Análise completada do settings.local.json | 5 min |
| 2 | Criar backup e versão otimizada | 10 min |
| 3 | Substituir settings.local.json | Imediato |
| 4 | Recuperar ambiente shell | Imediato |
| 5 | Otimizar agentes v3 (prioritário) | 30 min |
| 6 | Validar ambiente recuperado | 5 min |

## Riscos

1. **Loss de permissões críticas** - Mitigado por backup
2. **Agentes mal configurados** - Testar individualmente
3. **Downtime do ambiente** - Mínimo, pois MCPs não dependem do shell

## Próximos Passos

Após a recuperação do ambiente, executar:
1. `/environment-audit` novamente para validar
2. `npm run build` para verificar compilação
3. Testes críticos de integração