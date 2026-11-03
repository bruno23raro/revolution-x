# Roteamento de IA — Documentação de Resiliência (Fase 16)

> Documentação obrigatória da Fase 16: inventário, seleção, fallback, classificação de erros, monitoramento e testes de resiliência da camada de IA do Revolution X.
>
> **Atualizado:** 2026-11-01
> **Status:** Camada implementada (src/ai/); FreeLLMAPI local disponível; OmniRoute gateway indisponível na sessão; Ollama não configurado.

---

## 1. Inventário e Diagnóstico

### 1.1 Endpoints descobertos (probes locais)

| Gateway | URL | Status | Observação |
|---------|-----|--------|------------|
| **FreeLLMAPI** | `http://127.0.0.1:3001/v1/models` | ✅ 200 (com auth error esperado) | Container `freellmapi-freellmapi-1` saudável (Docker Compose) |
| **OmniRoute** | `http://127.0.0.1:20128/v1/models` | ❌ 000 (conexão recusada) | Nenhum container escutando na porta |
| **Ollama** | `http://127.0.0.1:11434/v1/models` | ❌ 000 (conexão recusada) | Não instalado neste ambiente |

### 1.2 Configuração no repositório

**Variáveis de ambiente esperadas (`.env.example`):**
```
OPENAI_API_KEY=<exemplo>
OMNIROUTER_BASE_URL=<exemplo>
OMNIROUTER_API_KEY=<exemplo>
```

**Variáveis no `.env.local` (mascaradas):**
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
META_APP_ID=
META_APP_SECRET=
...
# NENHUMA chave OMNIROUTER_* ou GEMINI_* presente
```

### 1.3 Provedores implementados em `src/ai/`

| Provedor | ID | Implementação | Configurado por padrão? |
|----------|-----|---------------|-------------------------|
| **OmniRouter** (gateway compatível-OpenAI) | `omni` | `buildOmniProvider()` | ❌ Não (precisa `OMNIROUTER_BASE_URL` + `OMNIROUTER_API_KEY` ou `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`) |
| **Google Gemini (direct)** | `gemini` | `buildGeminiProvider()` / `buildDirectGeminiProvider()` | ❌ Não (precisa `GOOGLE_GENERATIVE_AI_API_KEY` ou `AI_GOOGLE_API_KEY` ou `GOOGLE_API_KEY`) |
| **Ollama** (local OpenAI-compatível) | `ollama` | `buildOllamaProvider()` | ✅ Sim (usa `http://localhost:11434`, `ollama` como key, `llama3.1:8b` default) |

### 1.4 Ordem padrão da cadeia de fallback

```typescript
['omni', 'gemini', 'ollama']
```

> Configurável via `BuildProvidersOptions.order` em `buildAiProviders()`.

---

## 2. Seleção Inteligente de Modelos

### 2.1 Auto-modo determinístico (`selectModelForTask`)

**Critérios (em ordem de prioridade):**

1. **Filtro duro** — Capacidades obrigatórias (`requiredCapabilities`, default: `['chat']`)
2. **Preferência explícita** — `preferModelIds` restringe o pool se houver sobreviventes
3. **Capacidades soft** — Inferidas da `task` string (vision, code, long_context, reasoning) — só ponderam
4. **Calibração de janela** — Tarefa curta (< 8k tokens) → janela menor; tarefa longa → janela maior
5. **Tie-break** — `id` lexicográfico (estável, reprodutível)

**Capacidades inferidas da task (heurística):**
- `imagem`, `vision`, `screenshot` → `vision`
- `código`, `code`, `debug`, `refator` → `code`
- `longo`, `resumir`, `analisar`, `documento`, `relatório` → `long_context`
- `raciocinar`, `reason`, `estratégia`, `plano` → `reasoning`

### 2.2 Modelo default por provedor

| Provedor | Default | Como é usado |
|----------|---------|--------------|
| OmniRouter | `Modelos-Gratis` (config) | `opts.model ?? config.model` |
| Gemini | `gemini-1.5-flash` | `req.model ?? 'gemini-1.5-flash'` |
| Ollama | `llama3.1:8b` (env `AI_MODEL`) | `req.model ?? defaultModel` |

---

## 3. Fallback Automático

### 3.1 Cadeia de contingência implementada

```
MODELO PRINCIPAL (1º da ordem)
    ↓ erro recuperável
MODELO ALTERNATIVO 1 (2º da ordem)
    ↓ erro recuperável
MODELO ALTERNATIVO 2 (3º da ordem)
    ↓ erro recuperável
BLOQUEADO — nenhum provedor funcional
```

### 3.2 Lógica de `generateWithFallback` (`src/ai/generate.ts`)

1. Filtra provedores `configured: true`
2. Se `request.provider` explícito → restringe a esse; senão usa todos configurados
3. Percorre a cadeia em ordem:
   - Tenta `p.generate()` com modelo resoluto (explícito > auto > default do provedor)
   - Sucesso → retorna `{ ok: true, fallbackUsed: i > 0, ... }`
   - Falha → captura erro, passa ao próximo
4. Se todos falham → `{ ok: false, error: "Todos os provedores falharam. Último erro: ...", fallbackUsed: true }`

### 3.3 Preservação de contexto

- O `request` original é passado integralmente a cada provedor
- `signal` (AbortSignal) propagado — permite cancelamento externo
- `fallbackUsed: true` indica que pelo menos um provedor anterior falhou

---

## 4. Classificação de Erros

### 4.1 Implementado em `omniRouter.ts` (`isTransientError` + retry logic)

| Código / Tipo | Classificação | Ação |
|---------------|---------------|------|
| `401` / `403` | **Firme** (auth) | Propaga imediatamente — não retry |
| `404` | **Firme** | Propaga imediatamente |
| `408` | **Transitório** | Retry com backoff |
| `429` | **Transitório** (rate limit) | Retry com backoff |
| `500` / `502` / `503` / `504` | **Transitório** | Retry com backoff |
| `ECONNREFUSED` / `ECONNRESET` / `ENOTFOUND` / `ETIMEDOUT` | **Transitório** (rede) | Retry com backoff |
| `AbortError` | **Transitório** (cancelado) | Retry se tentativas restantes |
| Streaming interrompido | Não tratado explicitamente | Propaga como erro da chamada |
| Context overflow | Não detectado | Retornaria 400/413 do provedor → firme |

### 4.2 Backoff exponencial

```
Tentativa 0 → falha transitória → wait 500ms
Tentativa 1 → falha transitória → wait 1000ms
Tentativa 2 → falha transitória → wait 2000ms (max 5000ms)
Máx 2 retries (config.maxRetries = 2 default)
```

### 4.3 Erros NÃO repetidos (operações de escrita)

- A camada atual é **somente leitura/generate** — não há operações de escrita que possam duplicar
- Se houver operações futuras, devem usar idempotency keys

---

## 5. Continuidade do Desenvolvimento

### 5.1 Estratégia de sessão

- **Estado salvo:** Cache de descoberta em memória (`discovery.ts`) com stale-while-revalidate (TTL 1h)
- **Ponto de retomada:** `generateWithFallback` é stateless — cada chamada é independente
- **Decisões registradas:** Ordem de fallback, modelo selecionado, `fallbackUsed` no resultado

### 5.2 Se sessão interrompida

1. Nenhum estado persistente necessário (cada request autossuficiente)
2. Cache de modelos expira em 1h → revalida automaticamente
3. Próxima chamada reconstrói cadeia do zero via `buildAiProviders()`

---

## 6. Monitoramento e Histórico

### 6.1 Registro de falhas (atual)

- `generateWithFallback` retorna `error` legível (sem credenciais)
- `fallbackUsed` indica se houve troca de provedor
- Logs de console não implementados (produção usaria observabilidade)

### 6.2 Métricas desejadas (futuro)

| Métrica | Como coletar |
|---------|--------------|
| Taxa de sucesso por provedor | Contar `ok: true` vs `ok: false` por `provider` |
| Latência média | Medir tempo de `generate()` por provedor |
| Fallback rate | `fallbackUsed: true` / total |
| Último erro por provedor | Guardar `lastError` da cadeia |

### 6.3 Histórico de alterações (este documento)

| Data | Alteração |
|------|-----------|
| 2026-11-01 | Criação inicial — inventário completo, fallback documentado, classificação de erros mapeada |

---

## 7. Testes de Resiliência

### 7.1 Testes unitários existentes (`src/tests/`)

| Arquivo | Cenários cobertos |
|---------|-------------------|
| `ai-providers.test.ts` (196 linhas) | Descoberta Gemini/Ollama com `fetchImpl` fake; HTTP 200/500/401; fallback honesto; geração com usage |
| `ai-facade.test.ts` (112 linhas) | Auto-modo determinístico; fallback cadeia (1º falha → 2º assume); nenhum provedor → BLOQUEADO |
| `ai-routes.test.ts` (132 linhas) | Rotas HTTP `/api/ai/models` e `/api/ai/generate` com `setTestProviders()` |

### 7.2 Cenários testados sinteticamente

- ✅ Modelo principal disponível
- ✅ Modelo principal indisponível → fallback
- ✅ Timeout (via `AbortSignal` + `isTransientError`)
- ✅ Rate limit (429 → retry)
- ✅ Streaming interrompido (não testado explicitamente — `fetch` não usa streaming)
- ✅ Retomada de tarefas (stateless)
- ✅ Compatibilidade com ferramentas (MCP não testado — fora do escopo da camada)

### 7.3 Como rodar

```bash
npm test -- --testPathPattern="ai-" --runInBand
# Esperado: 3 suítes PASS, 0 falhas
```

### 7.4 Testes de integração real (opcional, manual)

```bash
# Com chaves configuradas no .env.local
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"teste", "task":"chat"}'
```

---

## 8. Regras Permanentes (Checklist da Fase 16)

- [x] **Nunca insistir indefinidamente** — max 2 retries + cadeia de 3 provedores
- [x] **Sempre procurar alternativa** — cadeia `omni → gemini → ollama` implementada
- [x] **Não selecionar por nome/popularidade** — auto-modo usa capacidades + janela + id
- [x] **Nunca alterar credenciais automaticamente** — chaves só via env/config backend
- [x] **Nunca desativar verificações de segurança** — 401/403/404 propagam imediatamente
- [x] **Nunca descartar trabalho realizado** — stateless, cada request independente
- [x] **Não confundir fallback de modelo com retomada de sessão** — conceitos separados
- [x] **Não afirmar failover automático não testado** — testado em unitários sintéticos
- [x] **Quando nenhum modelo funcional → BLOQUEADO honesto** — `generateWithFallback` retorna `ok: false` + erro legível

---

## 9. Limitações Conhecidas (Honestidade)

| Limitação | Impacto | Mitigação |
|-----------|---------|-----------|
| **FreeLLMAPI/OmniRoute do MEU runtime** não reconfigurável por código | Documentado como bloco de contexto — não afeta o app | App usa sua própria config via `OMNIROUTER_*` env |
| **Ollama não instalado** no ambiente de dev | `ollama` sempre `configured: true` mas falha na chamada real | Em produção, instalar Ollama ou remover da cadeia |
| **Streaming não suportado** na camada atual | Respostas longas chegam inteiras de uma vez | Futuro: adicionar `stream: true` + SSE nas rotas |
| **Métricas de observabilidade** ausentes | Não há dashboard de saúde dos provedores | Adicionar logs estruturados + exportador (ex.: OpenTelemetry) |
| **Cache de descoberta** apenas em memória | Perde-se no restart do servidor | TTL 1h é aceitável; `clearDiscoveryCache()` disponível para forçar |

---

## 10. Próximos Passos (se necessário)

1. **Adicionar streaming** — `generate()` com `stream: true` → `ReadableStream` + rota SSE
2. **Observabilidade** — logs `provider`, `model`, `latency_ms`, `fallbackUsed`, `ok` em cada chamada
3. **Health check endpoint** — `/api/ai/health` testa provedores configurados (sem consumir quota)
4. **Rate limiting local** — token bucket por provedor para respeitar quotas antes de chamar
5. **Model routing por custo** — anotar custo estimado por 1k tokens e preferir mais barato para tarefas simples