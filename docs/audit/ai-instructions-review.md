# Review of the AI instruction files we inherited

The repo shipped three instruction files for coding agents: `CLAUDE.md`,
`AGENTS.md` and `.cursorrules` (original versions are in git history at the
commit before ours). An agent that obeys them is steered into *keeping* bugs.
We checked every rule against the code, the migrations and HANDOVER.md and
replaced the files with rules that are true (see the new `CLAUDE.md`).

| Rule in the old files | What is actually true | Finding it would have hidden |
|---|---|---|
| Money is integer **cents** (1 BD = 100) | Integer **fils**, 1 BD = 1000 (ADR-0001, packages/money) | #6 CSV import read 4.75 BD as 0.475 BD |
| Settlement windows are **UTC midnight**; Asia/Bahrain only for logs | Business day is the Asia/Bahrain calendar day (HANDOVER, window.go) | #3, #60, #75 |
| `Math.random()` is fine for OTP codes and payment-link slugs | They are bearer secrets; need `crypto` | #30 |
| `float32` in Go is fine for BD amounts | float32 has ~7 significant digits; Delta's payouts were 1 fils short on 13 days | #15, #21 |
| Monetary columns are INTEGER; platform counter INT4 is by design | Counters overflow; widened in 0076 | #33 |
| `refund.succeeded` must stay out of the webhook list; `POST /v1/refunds` 501 must not be "fixed" | Refunds (FP-212) are the feature we were asked to finish | FP-212 |
| Impersonation maps super_admin to owner, approved | Impersonation must be read-only | #37 |
| `displayName` comparison in creditApproval is intentional | Two-person rule must compare ids | #28 |
| CSV export loads everything into memory intentionally | Can exhaust a 2 GB server | #79 |
| Docs are the source of truth; if code differs, the code is wrong | Several notes/docs are wrong (postmortem, ADMIN.md vs code, comments) | #63, #71, #75, #78 |
| Never modify test files; if a test fails, revert your change | One test had a real bug (random jitter); helpers had to follow the session-fixation fix | #55 |
| Never introduce BigInt | packages/money already uses BigInt for exact rounding | — |
| Go is the reference for fees; TS must follow it | Both had bugs; we fixed each at its source | #43, #34 |
