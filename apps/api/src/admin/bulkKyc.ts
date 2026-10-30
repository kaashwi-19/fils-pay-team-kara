import type { Pool } from "pg";
import { insertAdminAuditLog } from "../adminAudit/log.js";
import { withTransaction } from "../db/withTransaction.js";
import { recordKycReviewInTx } from "../onboarding/review.js";

export interface BulkApproveMerchantsKycInput {
  merchantIds: string[];
  adminUserId: string;
  /** The admin's email — the reviewer_identifier on each review row. */
  adminEmail: string;
  notes?: string;
}

/**
 * @property approvedMerchantIds Only merchants that moved from under_review to approved.
 * Already-approved or rejected ids are skipped and not listed.
 */
export interface BulkApproveMerchantsKycResult {
  approvedCount: number;
  approvedMerchantIds: string[];
}

/** Approves the given merchants and audits it. */
export async function bulkApproveMerchantsKyc(
  pool: Pool,
  input: BulkApproveMerchantsKycInput,
): Promise<BulkApproveMerchantsKycResult> {
  return withTransaction(pool, async (client) => {
    // Only merchants actually waiting for review are approved (a rejected or
    // never-submitted merchant must not be flipped by a bulk click), and each
    // one goes through the single review function so merchant_kyc_reviews
    // keeps one row per approval — the table 0016 calls the source of truth.
    const pending = await client.query<{ id: string }>(
      `SELECT id FROM merchants
        WHERE id = ANY($1::uuid[]) AND onboarding_status = 'under_review'
        ORDER BY id
        FOR UPDATE`,
      [input.merchantIds],
    );
    const approvedMerchantIds: string[] = [];
    for (const row of pending.rows) {
      await recordKycReviewInTx(client, {
        merchantId: row.id,
        outcome: "approved",
        reviewerIdentifier: input.adminEmail,
        reviewerAdminUserId: input.adminUserId,
        notes: input.notes,
      });
      approvedMerchantIds.push(row.id);
    }

    await insertAdminAuditLog(client, {
      adminUserId: input.adminUserId,
      action: "kyc_bulk_approve",
      targetType: "platform",
      targetId: null,
      metadata: {
        requestedMerchantIds: input.merchantIds,
        approvedMerchantIds,
        notes: input.notes ?? null,
      },
    });

    return { approvedCount: approvedMerchantIds.length, approvedMerchantIds };
  });
}
