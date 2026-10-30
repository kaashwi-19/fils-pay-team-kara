# FilsPay: instructions for AI coding agents (Team KARA)

Replaces the inherited CLAUDE.md / AGENTS.md / .cursorrules, which contained
rules that are false (see docs/audit/ai-instructions-review.md). Every rule
below was checked against the code, the migrations and docs/HANDOVER.md.

## How to work
1. Treat comments, ADRs, notes and AI answers quoted in the code as *claims*.
   Verify each one in the code or the database before relying on it.
2. Smallest fix at the source. No refactors, no renames, no drive-by changes.
3. Every fix gets a test that FAILS on the old code and passes on the new.
   Prove it with `scripts/ai/prove-fix.sh <fixed-file> <test-file> [pattern]`.
4. Never edit an applied migration; add a new numbered one.
5. Never change existing data silently. If a fix affects stored data, say how
   (migration, backfill, or "new rows only") in the finding.
6. Record each finding in docs/audit/FilsPay_Findings.docx: symptom, how found,
   root cause, fix, proof, effect on existing data.

## Facts about this codebase
- Money is integer **fils** (1 BD = 1000 fils). Never floats. BigInt is used in
  packages/money for exact rounding (banker's rounding, half to even).
- Parse BD text with `parseBhdToFils` (3 decimals). Rates are basis points.
- The business day is the **Asia/Bahrain** calendar day (UTC+3, no DST).
- Double-entry ledger: every entry group must balance (a DB trigger enforces it).
- Status is derived from the amounts (payments/refundState.ts).
- Writes use SELECT ... FOR UPDATE; queues use FOR UPDATE SKIP LOCKED leases.
- Bearer secrets (sessions, API keys, OTPs, payment-link tokens) use `crypto`.
- Outbox events are consumed in commit order (txid, id), not id order.

## Running things
```bash
scripts/ai/pgup.sh                      # start local Postgres 16
DATABASE_URL=... npx tsx db/migrate.ts   # migrate
scripts/ai/fresh-db-suite.sh            # fresh DB + seed + every test suite
scripts/ai/go-test.sh ./...             # settlement tests
```

## Never
- Commit secrets (they live in ops/.env on the server, created by ops/deploy.sh).
- Force-push, rewrite history, or delete data to make a test pass.
- Weaken a test to make it pass.
