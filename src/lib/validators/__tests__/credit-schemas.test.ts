import { describe, expect, it } from "vitest";

import {
  checkoutRequestSchema,
  creditEventSchema,
  planIdSchema,
} from "@/lib/validators/credit-schemas";

describe("credit-schemas", () => {
  const uuid = "00000000-0000-4000-8000-000000000000";

  it("planIdSchema: accepts known plan ids and rejects unknown", () => {
    expect(planIdSchema.parse("starter")).toBe("starter");
    expect(planIdSchema.parse("pro")).toBe("pro");

    const bad = planIdSchema.safeParse("free");
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes("Invalid planId"))).toBe(true);
    }
  });

  it("checkoutRequestSchema: valid and strict", () => {
    expect(checkoutRequestSchema.parse({ planId: "team" })).toEqual({ planId: "team" });

    const extra = checkoutRequestSchema.safeParse({ planId: "team", extra: true });
    expect(extra.success).toBe(false);
  });

  it("creditEventSchema: accepts valid event", () => {
    const out = creditEventSchema.parse({
      id: uuid,
      type: "render_debit",
      delta_ru: -10,
      render_job_id: null,
      description: null,
      created_at: "2020-01-01T00:00:00Z",
    });
    expect(out.type).toBe("render_debit");
  });

  it("creditEventSchema: rejects invalid fields", () => {
    expect(
      creditEventSchema.safeParse({
        id: "not-a-uuid",
        type: "render_debit",
        delta_ru: -10,
        render_job_id: null,
        description: null,
        created_at: "2020-01-01",
      }).success,
    ).toBe(false);

    expect(
      creditEventSchema.safeParse({
        id: uuid,
        type: "unknown_type",
        delta_ru: -10,
        render_job_id: null,
        description: null,
        created_at: "2020-01-01",
      }).success,
    ).toBe(false);

    expect(
      creditEventSchema.safeParse({
        id: uuid,
        type: "render_refund",
        delta_ru: 1.5,
        render_job_id: null,
        description: null,
        created_at: "2020-01-01",
      }).success,
    ).toBe(false);

    expect(
      creditEventSchema.safeParse({
        id: uuid,
        type: "render_refund",
        delta_ru: 1,
        render_job_id: "not-a-uuid",
        description: null,
        created_at: "2020-01-01",
      }).success,
    ).toBe(false);

    expect(
      creditEventSchema.safeParse({
        id: uuid,
        type: "render_refund",
        delta_ru: 1,
        render_job_id: null,
        description: null,
        created_at: "",
      }).success,
    ).toBe(false);
  });
});

