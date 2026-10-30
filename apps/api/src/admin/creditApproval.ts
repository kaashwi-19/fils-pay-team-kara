import { ConflictError } from "../lib/errors.js";

/** An operator on one side of a credit's two-person control. */
export interface CreditActor {
  adminUserId: string;
  displayName: string;
}

/** Two-person control: the operator who approves a credit must not be the one who requested it. */
export function assertDistinctApprover(requester: CreditActor, approver: CreditActor): void {
  // Compared by account id (as HANDOVER says), never by display name: a
  // name is not unique and can change, so the same admin could approve
  // their own credit after a rename, while two different "Ahmed"s could not.
  if (approver.adminUserId === requester.adminUserId) {
    throw new ConflictError("self_approval_forbidden");
  }
}
