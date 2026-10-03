import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { billingFromCursorUsage } from "../providers/cursor";
import { billingPatchFromRefresh } from "./provider-billing";

const usageSummary = {
  membershipType: "pro",
  billingCycleEnd: "2026-11-01T00:00:00.000Z",
  individualUsage: {
    plan: { enabled: true, totalPercentUsed: 37 },
  },
};

describe("Cursor limit refresh keeps a saved price", () => {
  it("does not null a hand-entered price when usage-summary has no amount", () => {
    const billing = billingFromCursorUsage(usageSummary);
    assert.equal("amountCents" in billing, false);

    const patch = billingPatchFromRefresh(billing, {
      notes: "Автосоздано при сохранении учётных данных",
    });

    assert.equal("amountCents" in patch, false);
    assert.equal(patch.amountCents, undefined);
    assert.equal(patch.name, "Cursor Pro");
    assert.equal(patch.nextBillingAt, "2026-11-01");
    assert.equal(patch.currency, "USD");
    assert.equal(patch.billingPeriod, "monthly");
  });

  it("keeps a stored $20 even when the row is not marked auto-created", () => {
    const billing = billingFromCursorUsage(usageSummary);
    const patch = billingPatchFromRefresh(billing, {
      notes: "Цена введена вручную",
    });
    assert.equal("amountCents" in patch, false);
  });

  it("drops an explicit null amount instead of clearing the stored price", () => {
    const patch = billingPatchFromRefresh({
      name: "Cursor Pro",
      amountCents: null,
      nextBillingAt: "2026-11-01",
    });
    assert.equal("amountCents" in patch, false);
    assert.equal(patch.name, "Cursor Pro");
    assert.equal(patch.nextBillingAt, "2026-11-01");
  });

  it("still applies a list price when the provider actually returns one", () => {
    const patch = billingPatchFromRefresh({
      name: "Cursor Pro",
      amountCents: 2000,
      currency: "USD",
    });
    assert.equal(patch.amountCents, 2000);
  });

  it("still clears an auto-created next billing date only when that option is set", () => {
    const billing = billingFromCursorUsage({ membershipType: "pro" });
    const cleared = billingPatchFromRefresh(billing, {
      clearSeedNextBilling: true,
      notes: "Автосоздано при сохранении учётных данных",
    });
    assert.equal(cleared.nextBillingAt, null);
    assert.equal("amountCents" in cleared, false);

    const kept = billingPatchFromRefresh(billing, {
      notes: "Автосоздано при сохранении учётных данных",
    });
    assert.equal("nextBillingAt" in kept, false);
  });
});
