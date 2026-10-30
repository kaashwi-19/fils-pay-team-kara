import assert from "node:assert/strict";
import { test } from "node:test";
import { EXPIRE_HOLDS_SQL } from "./expire_holds.js";
import { buildDelete } from "./lib/sqlFilter.js";

test("expiring holds is an UPDATE to 'expired' scoped to active, past-due holds — never a DELETE", () => {
  assert.match(EXPIRE_HOLDS_SQL, /^UPDATE holds SET status = 'expired'/);
  assert.match(EXPIRE_HOLDS_SQL, /status = 'active' AND expires_at < now\(\)/);
  assert.doesNotMatch(EXPIRE_HOLDS_SQL, /DELETE/i);
});

test("buildDelete with an empty id list matches nothing instead of the whole table", () => {
  const { text } = buildDelete("holds", { id: [] });
  assert.equal(text, "DELETE FROM holds WHERE false");
});

test("buildDelete refuses to build an unfiltered DELETE", () => {
  assert.throws(() => buildDelete("holds", {}), /refusing an unfiltered DELETE/);
});

test("buildDelete still scopes to the ids it was handed", () => {
  const ids = ["11111111-1111-1111-1111-111111111111"];
  const { text, values } = buildDelete("holds", { id: ids });
  assert.equal(text, "DELETE FROM holds WHERE id = ANY($1::uuid[])");
  assert.deepEqual(values, [ids]);
});
