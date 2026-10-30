/**
 * Refund drawer (FP-212), now wired: posts to
 * /v1/merchants/:merchantId/refunds. Changes from the parked draft: a
 * partially refunded payment can be refunded again, the limit is what is
 * still refundable (captured - refunded), and one Idempotency-Key is used per
 * opened form so a double-submit or retry can never refund twice.
 */
import { useState } from "react";
import { request } from "../../api/client.js";
import { describeError } from "../../api/client.js";
import { useDashboardAuth } from "../../auth/DashboardAuthContext.js";
import { RequireRole } from "../../auth/RequireRole.js";
import { bhd } from "../../format.js";
import { parseBhdToFils } from "@filspay/money";
import type { TransactionDto } from "../../types.js";

interface RefundResponse {
  id: string;
  transactionId: string;
  amountFils: number;
  feeReversedFils: number;
  status: string;
  transactionStatus: string;
  refundedTotalFils: number;
  occurredAt: string;
}

interface RefundDrawerProps {
  txn: TransactionDto;
  onRefunded: () => Promise<void>;
}

export function RefundDrawer({ txn, onRefunded }: RefundDrawerProps) {
  const { me } = useDashboardAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const merchantId = me?.merchant.id;
  const remaining = txn.capturedFils - txn.refundedFils;
  const refundable =
    (txn.status === "captured" || txn.status === "partially_captured" || txn.status === "partially_refunded") &&
    remaining > 0;
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  async function handleRefund(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!merchantId) return;
    if (!window.confirm("Refund this transaction? The money goes back to the cardholder and cannot be recalled.")) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const trimmed = amount.trim();
      // Left blank, amountFils is omitted entirely and the API refunds
      // everything still refundable — its own documented default, same
      // affordance the capture form has.
      // The merchant types BD (e.g. 100.500), like every amount on the page;
      // parseBhdToFils turns it into whole fils exactly (no floats).
      let amountFils: number | undefined;
      if (trimmed !== "") {
        try {
          amountFils = parseBhdToFils(trimmed);
        } catch {
          setError("Enter an amount in BD, for example 12.500");
          return;
        }
        if (amountFils <= 0 || amountFils > remaining) {
          setError(`Enter an amount between 0.001 and ${bhd(remaining)}`);
          return;
        }
      }
      const body = amountFils === undefined ? { transactionId: txn.id } : { transactionId: txn.id, amountFils };

      const refunded = await request<RefundResponse>(`/v1/merchants/${encodeURIComponent(merchantId)}/refunds`, {
        method: "POST",
        // One key per opened form: a double-click or a retry after a network
        // error replays the same refund instead of making a second one.
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      });

      setOpen(false);
      setAmount("");
      setIdempotencyKey(crypto.randomUUID());
      setNotice(`Refunded ${bhd(refunded.amountFils)}. It goes back to the cardholder and appears in the next settlement.`);
      // Refetch rather than patch: the refund wrote a new transaction_events
      // row server-side, so the timeline is stale, not merely shorter.
      await onRefunded();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!refundable) return notice ? <p className="dash-notice" role="status">{notice}</p> : null;

  return (
    <RequireRole allow={["owner", "finance"]}>
      <div className="dash-actions">
        {notice ? <p className="dash-notice" role="status">{notice}</p> : null}
        {error ? <p className="dash-error">{error}</p> : null}
        {open ? (
          <form className="dash-form dash-form-inline" onSubmit={(e) => void handleRefund(e)}>
            <label>
              Amount in BD (leave blank to refund everything still refundable)
              <input
                type="text"
                inputMode="decimal"
                placeholder={(remaining / 1000).toFixed(3)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <p className="dash-muted">Still refundable: {bhd(remaining)}</p>
            <button type="submit" className="dash-button" disabled={submitting}>
              {submitting ? "Refunding..." : "Refund"}
            </button>
            <button type="button" className="dash-button" disabled={submitting} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" className="dash-button" onClick={() => setOpen(true)}>
            Refund
          </button>
        )}
      </div>
    </RequireRole>
  );
}
