#!/usr/bin/env bash
# Prove a fix: the test passes with it, and fails with the fix stashed.
#   scripts/ai/prove-fix.sh apps/api/src/payments/capture.ts apps/api/src/routes/transactions.test.ts "expired"
set -uo pipefail
fixed="$1"; test_file="$2"; pattern="${3:-}"
run() { npx tsx --test ${pattern:+--test-name-pattern="$pattern"} "$test_file" 2>&1 | grep -E "^# (pass|fail)"; }
echo "== with the fix";    run
git stash push -q -- "$fixed"
echo "== without the fix (expect failures)"; run
git stash pop -q
