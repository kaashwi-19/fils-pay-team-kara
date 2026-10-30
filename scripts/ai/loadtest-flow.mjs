// Virtual users each loop: authorize -> capture -> partial refund, for DURATION seconds.
const KEY = process.argv[2], VUS = +process.argv[3], DURATION = +process.argv[4];
const base = "http://localhost:3000";
const card = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };
const lat = []; const codes = {}; let flows = 0;
async function call(path, body) {
  const t = performance.now();
  const r = await fetch(base + path, { method: "POST", headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) });
  lat.push(performance.now() - t); codes[r.status] = (codes[r.status] || 0) + 1;
  if (r.status === 503) await new Promise((s) => setTimeout(s, 1000));
  return r.ok ? r.json() : null;
}
const end = Date.now() + DURATION * 1000;
async function vu() { while (Date.now() < end) { try {
  const a = await call("/v1/transactions", { amountFils: 10000, card, reference: "load" }); if (!a) continue;
  const c = await call(`/v1/transactions/${a.id}/capture`, {}); if (!c) continue;
  const r = await call("/v1/refunds", { transactionId: a.id, amountFils: 2500 }); if (r) flows++;
} catch { codes.net = (codes.net || 0) + 1; } } }
await Promise.all(Array.from({ length: VUS }, vu));
lat.sort((a, b) => a - b); const p = (q) => lat[Math.floor(q * (lat.length - 1))].toFixed(0);
console.log(JSON.stringify({ VUS, DURATION, requests: lat.length, rps: (lat.length / DURATION).toFixed(0), flows, flowsPerSec: (flows / DURATION).toFixed(1), p50: p(0.5), p95: p(0.95), p99: p(0.99), codes }));
