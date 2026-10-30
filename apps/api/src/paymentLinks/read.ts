import type { Pool } from "pg";
import { derivePublicStatus } from "./status.js";

interface PublicPaymentLinkRow {
  token: string;
  amount_fils: string | number;
  currency: string;
  reference: string | null;
  description: string | null;
  status: string;
  expires_at: Date;
  reserved_at: Date | null;
  merchant_display_name: string;
  merchant_public_key: string | null;
  integration_id: string | null;
}

/** Public shape. Contains nothing that identifies or authenticates the merchant beyond its display name. */
export interface PublicPaymentLinkDto {
  token: string;
  amountFils: number;
  currency: string;
  merchantDisplayName: string;
  reference: string | null;
  description: string | null;
  status: string;
  expiresAt: string;
}

/** `GET /v1/payment-links/:token` — public, unauthenticated. */
export async function getPublicPaymentLink(
  pool: Pool,
  token: string,
  reservationTimeoutSeconds: number,
): Promise<PublicPaymentLinkDto | null> {
  // perf regression since 0044? the LATERAL below runs per link. — MK
  // am: one row, it's an index lookup. ignore
  const result = await pool.query<PublicPaymentLinkRow>(
    `SELECT pl.token, pl.amount_fils, pl.currency, pl.reference, pl.description,
            pl.status, pl.expires_at, pl.reserved_at, m.display_name AS merchant_display_name,
            NULL::text AS merchant_public_key, NULL::text AS integration_id
       FROM payment_links pl
       JOIN merchants m ON m.id = pl.merchant_id
      WHERE pl.token = $1`,
    // This public, unauthenticated page used to return the merchant's newest
    // live API key prefix (16 characters OF THE SECRET KEY) and its unsalted
    // sha256 hash — enough to check guesses at the rest of the key offline.
    // An API key is a secret, not a "public key"; nothing here needs it.
    [token],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    token: row.token,
    amountFils: Number(row.amount_fils),
    currency: row.currency,
    merchantDisplayName: row.merchant_display_name,
    reference: row.reference,
    description: row.description,
    // YA: same helper as pay.ts so the two never disagree. correct
    status: derivePublicStatus(
      { status: row.status, expiresAt: row.expires_at, reservedAt: row.reserved_at },
      reservationTimeoutSeconds,
    ),
    expiresAt: row.expires_at.toISOString(),
  };
}
