#!/usr/bin/env bash
# ============================================================================
# apply_dev.sh — aplica a cadeia SNAKE de multi-contas Meta AO PROJETO DEV.
#
#   DESTINO : urdmpzjycwywsjzhpntc  ("supabase-charcoal-lighthouse", DEV)
#   NUNCA   : ardpabjoepzhkpmkgwgu  (REVOLUTION X - PRODUÇÃO)
#
# Single-writer (uma so' a vez, sequencial, ON_ERROR_STOP em cada arquivo).
# Ordem (comprovada em banco descartavel local, ver docs/SUPABASE_DEV_REPORT
# §10):  002a(base) -> 005 -> 015 -> 016
#
# PRE-REQUISITOS HUMANOS (ver guia docs/DEV_APPLY_HUMAN_GUIDE_2026-10-21.md):
#   1) Definir a SENHA do Postgres do DEV no dashboard Supabase (Settings ->
#      Database -> Change password). Use uma senha NOVA e exclusiva; nunca
#      reutilize uma que ja' tenha circulado em chat. A senha NUNCA vai em
#      chat, log ou commit — ela entra so' por variavel de ambiente.
#   2) Exportar a conexao SEM commitar a senha (veja a linha de exemplo em
#      "USO"). Exporte via SUPABASE_DEV_DB_URL OU via PGPASSWORD/PGHOST/...
#
# BACKENDS DE CLIENTE (escolha UM):
#   A) psql nativo ou via Docker (padrao deste script):
#        PSQL_CMD="docker exec -i revolution-x-test-db-1 psql"   # Docker
#     ou apenas o `psql` do host, se existir.
#   B) Supabase CLI (sem psql; usa `supabase db query --db-url`):
#        RX_CLI=1
#     Ideal neste host (Windows/WSL2 sem psql): a conexao sai do proprio CLI.
#
# REDIRECIONAMENTO DE HOST (RX_DEV_DB_IP) — quando o hostname .supabase.co
#   NAO resolve nesta rede (DNS quebrado) mas um endereco crudo funciona
#   (neste host o IPv6 direto 2600:1f18:...:a267:5432 e o pooler IPv4 estao
#   abertos): defina RX_DEV_DB_IP com o literal (IPv4 ou IPv6). O script troca
#   o host da SUPABASE_DEV_DB_URL por esse literal SEM alterar usuario/senha/
#   porta/banco. O valor da senha NAO e' exibido em momento algum.
#
# PREFLIGHT (RX_PREFLIGHT=1): roda `SELECT 1` so-leitura ANTES de qualquer
#   DDL. Se a conexao/senha estiver errada, aborta com mensagem clara e
#   NADA e' escrito (protecao contra "meio-aplicado" na falha de auth).
#
# USO (exemplo, senha omitida):
#   export SUPABASE_DEV_DB_URL='postgresql://postgres.urdmpzjycwywsjzhpntc:<SENHA>@db.urdmpzjycwywsjzhpntc.supabase.co:5432/postgres?sslmode=require'
#   export RX_CLI=1            # backend B (sem psql)
#   export RX_DEV_DB_IP='2600:1f18:5b28:201:cc5b:f484:b084:a267'   # se o hostname nao resolver
#   export RX_PREFLIGHT=1
#   bash supabase/dev_apply/apply_dev.sh
# ============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF_DEV="urdmpzjycwywsjzhpntc"
REF_PROD="ardpabjoepzhkpmkgwgu"

PSQL="${PSQL_CMD:-psql}"

# --- entrada segura: DSN por arquivo git-ignored (sem eco / sem args) --------
# Permite que o humano lance o DSN (com a senha NOVA do DEV) num arquivo local
# FORA do versionamento e o script leia SEM imprimir o valor. Padrao:
#   supabase/.temp/dev_dburl   ('.temp/' ja' esta' no .gitignore)
#   ou defina RX_DEV_SECRET_FILE=/caminho/para/o/arquivo
# O arquivo contem a URL numa linha: postgresql://postgres.urdmpz...:<SENHA>@...
# Nunca aparece em stdout, historial de shell ou commit.
SECRET_FILE="${RX_DEV_SECRET_FILE:-$HERE/../.temp/dev_dburl}"
if [ -z "${SUPABASE_DEV_DB_URL:-}" ] && [ -f "$SECRET_FILE" ]; then
  SUPABASE_DEV_DB_URL="$(tr -d '\r\n' < "$SECRET_FILE" | head -n1)"
  echo "DSN carregada de '$SECRET_FILE' (valor NAO exibido)."
fi

# --- travas de destino -------------------------------------------------------
if [ -n "${SUPABASE_DEV_DB_URL:-}" ] && case "${SUPABASE_DEV_DB_URL}" in *"$REF_PROD"*) true;; *) false;; esac; then
  echo "ERRO: SUPABASE_DEV_DB_URL aponta para PRODUCAO ($REF_PROD). ABORTADO." >&2
  exit 1
fi
if [ -z "${SUPABASE_DEV_DB_URL:-}" ] && [ -z "${PGPASSWORD:-}" ] && [ -z "${PGHOST:-}" ]; then
  echo "ERRO: defina SUPABASE_DEV_DB_URL (ou PGPASSWORD+PGHOST+...) com a conexao do DEV." >&2
  echo "      A senha do banco NUNCA vai em chat, log ou commit." >&2
  exit 1
fi

# --- redirecionamento de host (RX_DEV_DB_IP) --------------------------------
# Se definido, troca o host da SUPABASE_DEV_DB_URL por um literal (IPv4/IPv6),
# preservando user/pass/port/db/query. So' atua quando ha SUPABASE_DEV_DB_URL.
pin_ip() {
  local url="$1"
  [ -z "${RX_DEV_DB_IP:-}" ] && { printf '%s' "$url"; return; }
  local scheme rest pre query userpass afterat hostport dbname host port pinned out
  case "$url" in
    postgres://*) scheme="postgres://" ;;
    postgresql://*) scheme="postgresql://" ;;
    *) printf '%s' "$url"; return ;;
  esac
  rest="${url#"$scheme"}"
  pre="${rest%%\?*}"
  query="${rest#*\?}"
  [ "$query" = "$pre" ] && query=""            # nao havia '?'
  userpass="${pre%%@*}"
  afterat="${pre#*@}"
  hostport="${afterat%%/*}"
  dbname="${afterat#*/}"
  [ "$dbname" = "$afterat" ] && dbname="postgres"   # nao havia '/'
  host="${hostport%%:*}"
  port="${hostport##*:}"
  [ "$port" = "$hostport" ] && port="5432"
  case "$RX_DEV_DB_IP" in
    *:* ) pinned="[$RX_DEV_DB_IP]" ;;           # literal IPv6 entre colchetes
    *    ) pinned="$RX_DEV_DB_IP" ;;
  esac
  out="${scheme}${userpass}@${pinned}:${port}/${dbname}"
  [ -n "$query" ] && out="${out}?${query}"
  printf '%s' "$out"
}

# --- backend: psql (host ou docker) — arquivo por stdin ----------------------
run_psql() { # run_psql <file>
  if [ -n "${SUPABASE_DEV_DB_URL:-}" ]; then
    $PSQL -v ON_ERROR_STOP=1 "$(pin_ip "$SUPABASE_DEV_DB_URL")" < "$1"
  else
    # honra PGPASSWORD/PGHOST/PGUSER/PGDATABASE/PGPORT (nativos do psql)
    $PSQL -v ON_ERROR_STOP=1 < "$1"
  fi
}

# --- backend: supabase CLI (sem psql) — arquivo por -f (visivel no host) -----
run_cli() { # run_cli <file>
  if [ -n "${SUPABASE_DEV_DB_URL:-}" ]; then
    supabase db query --db-url "$(pin_ip "$SUPABASE_DEV_DB_URL")" -f "$1"
  else
    # so funciona se ja' houver `supabase link` no projeto DEV
    supabase db query --linked -f "$1"
  fi
}

run_sql() { # run_sql <file>
  if [ "${RX_CLI:-0}" = "1" ]; then run_cli "$1"; else run_psql "$1"; fi
}

# --- status (sem segredos): backend + host efetivo ---------------------------
echo "backend: $([ "${RX_CLI:-0}" = "1" ] && echo "supabase-cli" || echo "psql (${PSQL})")"
if [ -n "${SUPABASE_DEV_DB_URL:-}" ]; then
  echo "host efetivo: $(pin_ip "$SUPABASE_DEV_DB_URL" | sed -E 's#//[^@/]+@#//<user>@#g' | sed -E 's#\?sslmode.*##g')"
fi
[ -n "${RX_DEV_DB_IP:-}" ] && echo "RX_DEV_DB_IP ativo: redirecionando host para '${RX_DEV_DB_IP}'"

# --- preflight: SELECT 1 so-leitura antes de qualquer DDL --------------------
if [ "${RX_PREFLIGHT:-0}" = "1" ]; then
  echo ""
  echo "===== PREFLIGHT (SELECT 1) ====="
  _pf="$(mktemp)"
  trap 'rm -f "$_pf"' EXIT
  printf "SELECT 1 AS ok;\n" > "$_pf"
  run_sql "$_pf"
  echo "PREFLIGHT ok: conexao autenticou."
fi

# --- aplicacao da cadeia DEV (005/015/016 vivem em supabase/migrations) ------
apply() { # apply <file>
  echo ""
  echo "===== APLICANDO  $(basename "$1")  -> DEV ====="
  run_sql "$1"
}

apply "$HERE/002a_supabase_base.sql"
apply "$HERE/../migrations/005_meta_integrations.sql"
apply "$HERE/../migrations/015_webhook_idempotency.sql"
apply "$HERE/../migrations/016_multi_meta_accounts.sql"

# --- verificacao (read-only) -------------------------------------------------
echo ""
echo "===== VERIFICACAO (read-only) ====="
run_sql "$HERE/verify_dev.sql"

echo ""
echo "OK: cadeia DEV aplicada e verificada."
echo "Prox.:  supabase/dev_apply/test_multiaccount.sql (so' apos isto)  +  guia §5/§6/§7."
