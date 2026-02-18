import { describe, expect, it } from "vitest";

import { OVERAGE_RATE_PER_RU, PLANS } from "@/lib/plans";

describe("plans", () => {
  it("exports the expected number of plans", () => {
    expect(PLANS.length).toBe(3);
  });

  it("each plan has required fields", () => {
    for (const p of PLANS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.priceMonthly).toBeGreaterThan(0);
      expect(p.creditsRu).toBeGreaterThan(0);
      expect(p.stripePriceId).toBeTruthy();
    }
  });

  it("plan ids are unique", () => {
    const ids = PLANS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("overage rate per RU is positive", () => {
    expect(OVERAGE_RATE_PER_RU).toBeGreaterThan(0);
  });
});
