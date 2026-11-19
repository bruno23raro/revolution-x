#!/bin/sh
set -e
export PGPASSWORD="$POSTGRES_PASSWORD"
for f in /migrations/*.sql; do
  echo "==> Aplicando $f"
  psql -v ON_ERROR_STOP=1 -h db -U revx -d "$POSTGRES_DB" -f "$f"
done
echo "==> Migrações concluídas"