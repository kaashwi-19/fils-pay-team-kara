import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { toFils, type Fils } from "@filspay/money";
import { requireMerchantAuth, requireMerchantRole, requireMerchantWriterActor } from "../auth/requireMerchantAuth.js";
import { assertRefundRequestScope, initiateMerchantRefund } from "../refunds/initiateMerchantRefund.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";

/**
 * Refunds (FP-212) — full and partial.
 *
 * Two paths reach the same handler, because both are documented: the
 * dashboard's RefundDrawer posts to /v1/merchants/:merchantId/refunds, and
 * API.md documents /v1/refunds for API-key callers. In both, the merchant
 * always comes from the authenticated context, never from the request body.
 *
 * Body: { transactionId: string, amountFils?: integer, reason?: string }
 * (amountFils omitted = refund everything still refundable).
 * Header: Idempotency-Key (required — the client's own key, so a retried
 * request can never refund twice).
 */

interface RefundBody {
  transactionId?: unknown;
  amountFils?: unknown;
  reason?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getIdempotencyKey(request: FastifyRequest): string {
  const header = request.headers["idempotency-key"];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) {
    throw new BadRequestError("idempotency_key_required", "Idempotency-Key header is required");
  }
  return key;
}

function parseBody(body: RefundBody | undefined): { transactionId: string; amountFils?: Fils; reason?: string } {
  const { transactionId, amountFils, reason } = body ?? {};
  if (typeof transactionId !== "string" || !UUID_PATTERN.test(transactionId)) {
    // An id that isn't a UUID can't match any transaction — same answer as an unknown one.
    throw new NotFoundError("transaction_not_found");
  }
  let amount: Fils | undefined;
  if (amountFils !== undefined) {
    if (typeof amountFils !== "number" || !Number.isSafeInteger(amountFils) || amountFils <= 0) {
      throw new BadRequestError("refund_amount_invalid", "amountFils must be a positive whole number of fils");
    }
    amount = toFils(amountFils);
  }
  if (reason !== undefined && (typeof reason !== "string" || reason.length > 500)) {
    throw new BadRequestError("invalid_reason", "reason must be a string of at most 500 characters");
  }
  return { transactionId, amountFils: amount, reason: reason as string | undefined };
}

function buildRefundHandler(app: FastifyInstance) {
  return async (
    request: FastifyRequest<{ Params: { merchantId?: string }; Body: RefundBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const auth = request.merchantAuth!;
    if (request.params.merchantId !== undefined) {
      assertRefundRequestScope(auth, request.params.merchantId);
    }
    const idempotencyKey = getIdempotencyKey(request);
    const { transactionId, amountFils, reason } = parseBody(request.body);

    const result = await initiateMerchantRefund(app.db, app.acquirer, {
      merchantId: auth.merchantId,
      transactionId,
      amountFils,
      idempotencyKey,
      actor: requireMerchantWriterActor(auth),
      reason,
    });
    reply.code(result.statusCode).send(result.body);
  };
}

const preHandler = [requireMerchantAuth, requireMerchantRole("owner", "finance")];

/** Registered with prefix '/v1/refunds'. */
export async function refundRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { merchantId?: string }; Body: RefundBody }>("/", { preHandler }, buildRefundHandler(app));
}

/** Registered with prefix '/v1/merchants'. */
export async function merchantRefundRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { merchantId?: string }; Body: RefundBody }>(
    "/:merchantId/refunds",
    { preHandler },
    buildRefundHandler(app),
  );
}
