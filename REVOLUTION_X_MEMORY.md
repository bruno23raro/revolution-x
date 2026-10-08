# REVOLUTION X — MEMÓRIA PERSISTENTE

## PALAVRA-CHAVE DE RECUPERAÇÃO

REVOLVER

Quando o usuário iniciar uma sessão e dizer apenas "REVOLVER", leia este arquivo
e todos os arquivos de memória/documentação relacionados ao Revolution X antes
de continuar qualquer trabalho.

## REGRA PRINCIPAL

Este arquivo é um checkpoint persistente do projeto.
Não inventar informações ausentes.
Não expor secrets, tokens, senhas, cookies ou conteúdo de .env.

## ESTADO ATUAL

Projeto: Revolution X
Stack: Next.js 14 + TypeScript + Prisma + Supabase/PostgreSQL
Objetivo: SaaS omnichannel multi-tenant.

## RECUPERAÇÃO

A autoridade do projeto é:
1. código atualmente existente;
2. Git/histórico;
3. banco de dados real;
4. documentação/checkpoints;
5. somente depois recriar o que realmente estiver ausente.

Nunca tentar recuperar arquivos de outro computador sem solicitação explícita.

## ÚLTIMO ESTADO CONHECIDO (2026-10-08)

- Build da Hostinger `01a11d71` concluído com sucesso (commit `f232a8d`).
- Site público carrega em https://revolutionx.com.br (HTTP 200).
- Todas as APIs retornam 401 `{"error":"Unauthorized"}` quando não autenticadas — comportamento correto.
- /api/products sem sessão → HTTP 401 (corrigido; anteriormente 500 por build quebrado).
- TypeScript: 0 errors.
- Prisma validate: OK (schema válido).
- DATABASE_URL configurado para conexão direta (`db.*.supabase.co`) — evita ENOIDENTIFIER.
- META_* variáveis no Hostinger ainda como placeholders — requer intervenção manual.
- Supabase Auth em produção retornou erro intermitente "Database error querying schema" (500) em alguns momentos — pode ser instabilidade temporária do serviço GoTrue.
- Usuário de teste `prodtestlogin@example.com` criado no Supabase + Prisma, mas login falha consistentemente com "Invalid login credentials". Pode ser problema de hook/trigger ou configuração do projeto Supabase.
- Página de login em /login mostra apenas "Entrar / Fluxo preparado." — formulário não implementado ainda.

## GIT

Repositório: https://github.com/bruno23raro/revolution-x.git

Branch principal: main

Último commit: f232a8d20224a4e5a3c52ba1babd34f378e91cc3

Mensagem: fix: add postinstall prisma generate to fix production build

## BANCO

Banco: Supabase/PostgreSQL (conexão direta: `db.ardpabjoepzhkpmkgwgu.supabase.co`).
Conexão via pooler transacional causa ENOIDENTIFIER — usar conexão direta.
Migrations históricas 001–012 não devem ser executadas novamente sem análise.

## SEGURANÇA

Nunca mostrar:
- .env, .env.local, .env.supabase
- DATABASE_URL, JWT_SECRET
- Supabase service role key
- Tokens, cookies, credenciais

## DEPLOY

Plataforma: Hostinger (Node.js 24, Next.js, npm).
Mecanismo: git push para origin/main dispara build automático.
Postinstall: `prisma generate || exit 0` (fix crítico aplicado em f232a8d).
Commit implantado: f232a8d — Build `01a11d71` — completed 2026-10-08T21:37:28Z.

## VALIDAÇÕES TÉCNICAS

- typecheck: PASS
- prisma validate: PASS
- Build Hostinger: PASS
- Homepage (/): 200
- /api/products (sem auth): 401
- /api/crm/contacts (sem auth): 401
- /api/crm/deals (sem auth): 401
- /api/crm/leads (sem auth): 401
- /api/crm/pipelines (sem auth): 401
- /api/auth/login (usuário inexistente): 401 `{"error":"invalid_credentials"}`
- /api/auth/session (sem cookie): 200 `{"authenticated":false}`
- Isolamento multi-tenant: NÃO validado em produção (requer sessão autenticada)

## PENDÊNCIAS / BLOQUEIOS

1. **Login em produção não funciona** — Supabase Auth retorna "Invalid login credentials" mesmo com hash bcrypt correto. Possível hook/trigger removido ou problema no serviço GoTrue. Requer verificação no dashboard Supabase (Authentication → Settings → Email).
2. **Página de login não implementada** — /login exibe placeholder. Formulário com email/senha precisa ser construído.
3. **META_* env vars** — valores placeholder no Hostinger. Necessário restaurar valores reais para webhook Meta/WhatsApp funcionar.
4. **Teste de isolamento multi-tenant** — requer sessão autenticada em produção para validar.
5. **Meta/WhatsApp webhook** — não testável sem valores reais de META_APP_ID, META_APP_SECRET, META_TOKEN_ENCRYPTION_KEY.

## COMO CONTINUAR

Ao receber "REVOLVER":

1. Ler esta memória.
2. Inspecionar git status e HEAD.
3. Inspecionar documentação/checkpoints existentes.
4. Verificar o estado real do código antes de alterar.
5. Não repetir uma tentativa que já falhou duas vezes.
6. Fazer mudanças somente quando houver evidência.
7. Validar:
   - Prisma
   - TypeScript
   - testes
   - build
   - APIs
   - autenticação
   - isolamento multi-tenant
8. Commitar alterações válidas.
9. Push somente quando apropriado.
10. Deploy somente depois dos gates.
11. Nunca inventar resultados.
