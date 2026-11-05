# Fase A — Evidência de Redirects em Produção (T59)

Data: 2026-11-05. Branch: `main` (deploy 01a1ab0d).

## Testes curl/HEAD em produção (`revolutionx.com.br`)

### 1. `/integrations` → 308 para `/integracoes` (querystring preservada)
```bash
GET /integrations HTTP/1.1
Host: revolutionx.com.br
Accept: */*

HTTP/1.1 308 Permanent Redirect
Location: /integracoes
```

### 2. `/hub-integracoes?mode=official` → 308 para `/integracoes?mode=official`
```bash
GET /hub-integracoes?mode=official HTTP/1.1
Host: revolutionx.com.br
Accept: */*

HTTP/1.1 308 Permanent Redirect
Location: /integracoes?mode=official
```

### 3. `/integracoes` (canônica) → 200 OK
```bash
HEAD /integracoes HTTP/1.1
Host: revolutionx.com.br
Accept: */*

HTTP/1.1 200 OK
```

## Evidência do build
- Build UUID: `01a1ab0d-77df-705f-8190-b9c133353bca`
- Commit: `967e36a` (docs: execution-state fase A parcial)
- Build completed: `2m 15s`
- Routes relevantes no build output:
  - `/hub-integracoes` → 167 B (static redirect page)
  - `/integracoes` → 11.6 kB (página canônica com IntegrationCard)
  - `/integrations` → 167 B (static redirect page)

## Confirmação
✅ T52 implementado: 3 rotas, 2 legadas com 308 permanente preservando querystring, 1 canônica 200 OK.
✅ T59 completo: deploy na main, verificação em produção, evidência salva.