#!/usr/bin/env bash
# Fresh database, migrate, seed, then every test suite. What we ran before each push to the server.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=filspay_final
psql "postgres://postgres@/postgres?host=/tmp" -qc "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB OWNER filspay"
export DATABASE_URL=postgres://filspay:filspay_dev_password@localhost:5432/$DB
npx tsx db/migrate.ts && npx tsx db/seed/index.ts
(cd apps/api && npx tsx --test $(git ls-files 'src/**/*.test.ts'))
(cd apps/reporting && npx tsx --test $(git ls-files 'src/**/*.test.ts'))
(cd apps/web && npx tsx --test src/dashboard.test.ts)
npx tsx --test $(git ls-files 'scripts/*.test.ts' 'packages/**/*.test.ts')
scripts/ai/go-test.sh ./...
for d in apps/web apps/admin apps/api apps/reporting; do (cd $d && npx tsc --noEmit -p .); done
