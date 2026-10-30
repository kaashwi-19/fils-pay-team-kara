import assert from "node:assert/strict";
import { test } from "node:test";
import { validateWebhookUrl } from "./create.js";

const prod = { nodeEnv: "production" as const };

test("production refuses webhook URLs pointing inside our network (SSRF)", () => {
  for (const url of [
    "https://127.0.0.1/hook",
    "https://localhost/hook",
    "https://10.1.2.3/hook",
    "https://192.168.0.5/hook",
    "https://172.20.0.2/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/hook",
    "https://settlement:8091/internal/run-batch",
    "https://postgres/hook",
  ]) {
    assert.throws(() => validateWebhookUrl(url, prod), /invalid_url|public host/, url);
  }
});

test("production still accepts a public https endpoint", () => {
  assert.equal(validateWebhookUrl("https://merchant.example.com/hooks", prod).hostname, "merchant.example.com");
});

test("development still allows a local http receiver", () => {
  assert.doesNotThrow(() => validateWebhookUrl("http://127.0.0.1:9/hook", { nodeEnv: "development" }));
});
