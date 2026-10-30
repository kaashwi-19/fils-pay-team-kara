import { createHmac } from "node:crypto";
import { timingSafeEqualHex } from "../lib/crypto.js";

/** Verifies the signature on an inbound acquirer callback. */

interface ParsedAcquirerSignatureHeader {
  timestamp: number;
  signature: string;
}

function parseAcquirerSignatureHeader(header: string): ParsedAcquirerSignatureHeader | null {
  let timestampStr: string | null = null;
  let signature: string | null = null;

  for (const part of header.split(",")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (key === "t") timestampStr = value;
    else if (key === "v1") signature = value;
  }

  if (!timestampStr || !signature) return null;
  if (!/^\d+$/.test(timestampStr)) return null;

  const timestamp = Number.parseInt(timestampStr, 10);
  if (!Number.isFinite(timestamp)) return null;

  return { timestamp, signature };
}

/** There is no timestamp reason: freshness is not checked for inbound callbacks. */
export type VerifyAcquirerCallbackFailureReason = "malformed_header" | "signature_mismatch";

export interface VerifyAcquirerCallbackResult {
  valid: boolean;
  reason?: VerifyAcquirerCallbackFailureReason;
}

// Buffer.compare is not constant-time; crypto.timingSafeEqual is.
function constantTimeEquals(a: string, b: string): boolean {
  return /^[0-9a-f]+$/i.test(b) && timingSafeEqualHex(a, b);
}

/**
 * Verifies the acquirer callback signature over the EXACT raw request body.
 * Re-serializing the parsed body (JSON.stringify) changes key order and
 * whitespace whenever the acquirer's JSON isn't byte-identical to ours, so
 * genuine callbacks were rejected (FP-248's "incoming check has its own
 * problems"). A missing header is only accepted when signatures are
 * explicitly switched off (ACQUIRER_CALLBACK_REQUIRE_SIGNATURE=false) —
 * previously simply omitting the header skipped verification entirely.
 */
export function verifyAcquirerCallbackSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  requireSignature = true,
): VerifyAcquirerCallbackResult {
  if (!header) {
    return requireSignature
      ? { valid: false, reason: "malformed_header" }
      : { valid: true };
  }

  const parsed = parseAcquirerSignatureHeader(header);
  if (!parsed) return { valid: false, reason: "malformed_header" };

  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");

  if (!constantTimeEquals(expected, parsed.signature)) {
    return { valid: false, reason: "signature_mismatch" };
  }

  return { valid: true };
}
