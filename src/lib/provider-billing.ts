import type { ProviderBilling } from "@/providers/types";

/**
 * Billing fields to persist after a usage refresh.
 *
 * Cursor usage-summary and Claude usage omit the list price. A missing or
 * null amount is not a price: do not overwrite the amount the user saved
 * (including an auto-created row they later edited, and a stored $20).
 * Plan name, currency, period, and next billing date still pass through
 * when the provider actually returned them.
 */
export function billingPatchFromRefresh(
  billing: ProviderBilling,
  opts: { clearSeedNextBilling?: boolean; notes?: string | null } = {}
): ProviderBilling {
  const patch: ProviderBilling = { ...billing };
  if (patch.amountCents == null) {
    delete patch.amountCents;
  }
  if (opts.clearSeedNextBilling && !("nextBillingAt" in billing)) {
    if ((opts.notes || "").includes("Автосоздано")) {
      patch.nextBillingAt = null;
    }
  }
  return patch;
}
