# ROTEIRO SEGURO — 2ª ROTAÇÃO DA SENHA DO BANCO (Supabase), 2026-10-17

> **Regra deste documento: nenhum valor de segredo.** A senha aparece sempre como o
> placeholder `NOVA_SENHA`. Só identificadores públicos (host, porta, usuário, banco)
> são mostrados — eles já estão no repositório público.

## Por que uma segunda rotação
- A 1ª rotação de hoje deixou a senha `02588aef…` (referência curta; **não reproduzo o
  valor completo**) em hpanel + `.env.local`.
- Esse valor foi **digitado no chat** e **indexado pelo claude-mem (P268)** → passa a ser
  tratado como **exposto**.
- **Neutralização:** revogar o valor **na fonte** (Supabase) e substituí-lo em todos os
  alvos. Um valor que não autentica mais em lugar nenhum é inofensivo, mesmo que continue
  em transcrições/índices.

## Topologias (identificadores públicos — só a senha é secreta)
| Uso | Host | Porta | Usuário | Banco |
| --- | --- | --- | --- | --- |
| hpanel (direta) | `db.ardpabjoepzhkpmkgwgu.supabase.co` | 5432 | `postgres` | `postgres` |
| `.env.local` (pooler, session) | `aws-0-sa-east-1.pooler.supabase.com` | 5432 | `postgres.ardpabjoepzhkpmkgwgu` | `postgres` |
| `.env.local` (pooler, tx) | `aws-0-sa-east-1.pooler.supabase.com` | 6543 | `postgres.ardpabjoepzhkpmkgwgu` | `postgres` |

A **mesma** `NOVA_SENHA` serve às duas topologias (senha compartilhada do banco). A rotação
na fonte do Supabase propaga para as duas de uma vez.

## O que é SEU (campo seguro — nunca pelo chat)
1. **Gerar a `NOVA_SENHA`** forte (32–40 chars) num local seguro (gerenciador de senhas ou
   papel). Não passe o valor para a conversa.
2. **Fonte — Supabase:** Settings → Database → *Change/Reset Database Password* → cole a
   `NOVA_SENHA`. **Isso revoga a senha antiga na hora.**
3. **hpanel (Hostinger):** `DATABASE_URL` e `DIRECT_URL` → troque **só a senha** por
   `NOVA_SENHA` (topologia direta, tabela acima; o resto do `postgresql://…` fica igual).
   Salve.
4. **`.env.local`** (só na sua máquina; não versionado): `DATABASE_URL` (pooler, porta 5432)
   e `DIRECT_URL` (pooler, porta 6543) → troque **só a senha** por `NOVA_SENHA`.
5. **Outros `.env*` locais** (`.env`, `.env.local.prisma`, `.env.txt`, `.env.supabase`): a
   revogação **na fonte do Supabase invalida todos de uma vez**. Atualize só os que você
   realmente usa; os demais ficam simplesmente inúteis (não conectam mais) — sem risco.

> ⚠️ **Janela de queda:** entre o passo 2 (revogação na fonte) e o re-deploy abaixo,
> produção ainda usa a senha antiga embutida — ou seja, ela já foi revogada. Para deixar a
> janela curta, faça os passos 2 → 3 → 4 **seguidos, numa sentada**, e aí me avise.

## O que EU faço (autônomo, sem expor segredo)
- **Re-deploy:** `git push origin main` (~1-2 min; o push re-injeta o hpanel env novo no
  processo de produção). É isso que faz o app de produção passar a usar a `NOVA_SENHA`.
- **Smoke público** (sem segredo):
  - `GET https://revolutionx.com.br/` → 200
  - `GET /api/admin/chat` → 200 `routerConfigured:false`
  - `GET /api/admin/tasks` **sem sessão** → 401 (gate admin intacto)
- **Prova de banco em produção** (passo final — exige sua sessão admin): `GET
  /api/admin/tasks` **com sessão admin** → 200 `{"count":0}`. É a prova definitiva de que o
  app de produção fala com o banco pela `NOVA_SENHA`. Executo quando você der **CONTINUE**.
- **Registro** em `docs/EXECUTION_LOG.md` + `docs/EXECUTION_STATE.md` + memória — **sem
  valor de senha**; a `02588aef…` fica revogada e irrelevante.

## Verificação local opcional (você, na sua máquina — a senha não vai pro chat)
```powershell
# Windows PowerShell, na pasta do projeto:
$env:PGHOST="db.ardpabjoepzhkpmkgwgu.supabase.co"; $env:PGPORT="5432"
$env:PGUSER="postgres"; $env:PGDATABASE="postgres"; $env:PGPASSWORD="<aqui a NOVA_SENHA>"
node scripts/db-conn-test.mjs
```
O script imprime só `{result, ms, now, user, db, host, port}` — **nunca a senha**.

## Limitação do navegador (passo final)
O navegador controlável disponível (chrome-devtools) está em `about:blank`, **sem sessão**.
Eu abro `https://revolutionx.com.br/login` nele e **você** faz o login administrativo nessa
janela (você a vê). Só com a sua sessão é que consigo autenticar o `GET /api/admin/tasks`.
Se a ferramenta não puder acessar a sessão, declaro a limitação e explico a alternativa
(ex.: você roda o `curl`/`Invoke-RestMethod` do probe localmente e me passa **só o código
HTTP + o corpo**, nunca o cookie).
