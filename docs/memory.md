# Memory — Revolution X

## Ambiente
- Raiz: C:\Users\Bruno\.claude\Revolution\X
- docker: %LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe (engine ativo, contexto desktop-linux)
- curl: C:\Windows\System32\curl.exe
- Postgres do projeto: x-pg em 127.0.0.1:55432. 5432 e postgres nativo, nao usar.
- Obsidian REST 27123 validado 200.
- Env total 5087/32767: ENAMETOOLONG nao e tamanho de ambiente.

## Chaves (onde moram, nunca o valor)
- GitHub PAT: .env
- Obsidian: .claude (MCP header)
- Resend: .env.production EMAIL_API_KEY
- Supabase: .env.local

## Decisoes
- ADR-001: WhatsApp so via OpenBSP. Ver arquiteture.md.
- ADR-002: canal nao oficial apenas como fallback.

## Falhas conhecidas
- docker update nao define env; exige recreate (so supabase-auth liberado).
- plugin:github com header malformado na UI; usar `claude mcp add --transport http --header`.
- 54321 e gateway HTTP, nao fala protocolo Postgres sem prova.

## Proximo passo
W-01 do tarefas.md.