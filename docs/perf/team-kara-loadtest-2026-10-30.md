# Load test, Team KARA, 30 Oct 2026

Setup: API in production mode (`NODE_ENV=production`, `npx tsx` as in compose)
pinned to **one CPU** with `taskset -c 0` (the server has 1 vCPU), Postgres 16
on the same machine, fresh seeded database. Acquirer simulator at its default
100-400 ms latency and 2% failure rate.

Tools: `autocannon` for reads; `scripts/ai/loadtest-flow.mjs` for writes (each
virtual user loops authorize -> capture -> partial refund with a fresh
Idempotency-Key per call; clients wait 1 s on a 503, as Retry-After says).

| Run | Pool | VUs | Requests/s | Full flows/s | p50 | p95 | p99 | Errors |
|---|---|---|---|---|---|---|---|---|
| Read `GET /v1/transactions` (autocannon, 50 conns, 20 s) | 5 | 50 | 1,920 | - | 23 ms | 47 ms (p97.5) | 60 ms | 0 |
| Write flow, original pool | 5 | 20 | 28 | 9.3 | 699 ms | 1,275 ms | 1,456 ms | 0 |
| Write flow, original pool | 5 | 100 | 30 | 9.8 | 2,942 ms | 8,190 ms | 9,159 ms | 0 |
| Write flow, pool 20 | 20 | 20 | 76 | 24.6 | 267 ms | 400 ms | 412 ms | 0 |
| Write flow, pool 20 | 20 | 100 | 104 | 33.3 | 935 ms | 1,671 ms | 2,029 ms | 0 |
| Overload, no shedding | 20 | 400 | 120 | 37.8 | 3,360 ms | 8,880 ms | 9,873 ms | 0 (clients would time out) |
| Overload, shedding at 100 in flight | 20 | 400 | 405 (incl. 503s) | 31.4 | 13 ms | 1,382 ms | 1,822 ms | 6,000 fast 503s with Retry-After |

402 = card declined and 502 = acquirer error are the simulator's intended
outcomes (2% failure rate), not server errors. After every run all ledger entry
groups balanced (0 unbalanced groups) and `/healthz` answered in ~2 ms.

## Bottleneck
Every authorize/capture/refund holds a database connection (and the row lock)
while the acquirer answers (100-400 ms). With the default pool of 5 the API
could finish at most ~5 / 0.25 s = 20 acquirer calls per second, whatever the
CPU was doing. Raising the pool to 20 gave 2.7x the throughput. The next limit
is the acquirer latency itself; moving the acquirer call outside the database
transaction is the real fix (left as an open risk: it changes the
idempotency/locking design).

## Capacity estimate
~33 complete pay-capture-refund flows per second sustained (~100 write
requests/s) and ~1,900 read requests/s on one vCPU. If a simulated shopper
makes one purchase every 30 s, that is roughly 1,000 concurrent shoppers;
read-heavy dashboard users are not the limit.

## Overload
Past 100 requests in progress the API answers `503 {"error":"overloaded"}`
with `Retry-After: 1` immediately, before any database work, so admitted
requests stay fast and memory stays flat. Health checks are never shed, so
Docker does not restart a busy-but-healthy API. When the burst ends, the next
run (20 VUs) was back to normal latency (p95 404 ms) with no restart.
