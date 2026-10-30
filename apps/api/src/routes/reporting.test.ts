/** Route-level tests for /v1/reporting scope rules. Requires DATABASE_URL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("reporting.test.ts requires DATABASE_URL");
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", INTERNAL_API_TOKEN: "t" });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

async function merchantWithKey(label: string) {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [
    `Reporting ${label} ${randomUUID()}`,
  ]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'x') RETURNING id`,
    [merchantId, `${label}-${randomUUID()}@example.test`],
  );
  const key = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label });
  return { merchantId, rawKey: key.rawKey };
}

test("a merchant cannot read another parent's sub-merchant transactions", async () => {
  const parent = await merchantWithKey("parent");
  const child = await merchantWithKey("child");
  const outsider = await merchantWithKey("outsider");
  await pool.query(
    `INSERT INTO merchant_split_children (parent_merchant_id, child_merchant_id, split_weight_bps) VALUES ($1, $2, 10000)`,
    [parent.merchantId, child.merchantId],
  );
  await pool.query(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference)
     VALUES ($1, 'captured', 1000, 1000, $2)`,
    [child.merchantId, `acq-${randomUUID()}`],
  );
  const filter = encodeURIComponent(JSON.stringify({ merchantId: child.merchantId }));

  const asParent = await app.inject({
    method: "GET",
    url: `/v1/reporting/transactions?filter=${filter}`,
    headers: { authorization: `Bearer ${parent.rawKey}` },
  });
  assert.equal(asParent.statusCode, 200, asParent.body);
  assert.equal((asParent.json() as unknown[]).length, 1, "the parent may read its own sub-merchant");

  const asOutsider = await app.inject({
    method: "GET",
    url: `/v1/reporting/transactions?filter=${filter}`,
    headers: { authorization: `Bearer ${outsider.rawKey}` },
  });
  assert.equal(asOutsider.statusCode, 200, asOutsider.body);
  for (const row of asOutsider.json() as Array<{ merchantId: string }>) {
    assert.equal(row.merchantId, outsider.merchantId, "an outsider only ever sees its own transactions");
  }
});

test("export-summary requires authentication (401, not a 500 crash)", async () => {
  const res = await app.inject({ method: "GET", url: "/v1/reporting/export-summary" });
  assert.equal(res.statusCode, 401, res.body);
});
