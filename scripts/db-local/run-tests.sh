#!/usr/bin/env bash
# Tests de la base sans Docker : Postgres nu + imitation de Supabase + mini pgTAP.
# Usage : PGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres scripts/db-local/run-tests.sh
# La référence reste `supabase test db` (CI), sur le vrai Supabase.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${PREUVIO_TEST_DB:-preuvio_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

dropdb --if-exists "$DB" >/dev/null
createdb "$DB"
psql -X -q -d "$DB" -c "alter database $DB set search_path = \"\$user\", public, extensions" >/dev/null

"${PSQL[@]}" -f "$ROOT/scripts/db-local/supabase-shim.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/scripts/db-local/pgtap-lite.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migration  $(basename "$f")"
  sed -E '/create extension if not exists (pgmq|pg_cron|pg_net);/d' "$f" | "${PSQL[@]}" >/dev/null
done
echo "seed       seed.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null

failed=0
for f in "$ROOT"/supabase/tests/database/*.sql; do
  out="$(sed '/create extension if not exists pgtap/d' "$f" | psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" 2>&1)" || {
    echo "ERREUR     $(basename "$f")"; echo "$out"; failed=1; continue; }
  total="$(grep -c '^ok \|^not ok ' <<<"$out" || true)"
  if grep -q '^not ok \|^# ' <<<"$out"; then
    echo "ÉCHEC      $(basename "$f")"; grep '^not ok \|^# ' <<<"$out"; failed=1
  else
    echo "ok         $(basename "$f") ($total tests)"
  fi
done

dropdb "$DB"
exit "$failed"
