import { describe, expect, it } from "vitest";

import {
  createRenderJobSchema,
  updateRenderJobSchema,
} from "@/lib/validators/render-schemas";

describe("render-schemas", () => {
  const projectVersionId = "00000000-0000-4000-8000-000000000001";

  it("createRenderJobSchema: accepts valid input", () => {
    const out = createRenderJobSchema.parse({
      projectVersionId,
      tier: "draft",
      projectJson: { schemaVersion: 1 },
    });
    expect(out.tier).toBe("draft");
  });

  it("createRenderJobSchema: rejects invalid tier", () => {
    const res = createRenderJobSchema.safeParse({
      projectVersionId,
      tier: "gold",
      projectJson: {},
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message.includes("Invalid tier"))).toBe(true);
    }
  });

  it("updateRenderJobSchema: allows transitions per allowedTransitions map", () => {
    expect(
      updateRenderJobSchema.safeParse({ status: "rendering", fromStatus: "pending" }).success,
    ).toBe(true);

    expect(
      updateRenderJobSchema.safeParse({ status: "failed", fromStatus: "pending" }).success,
    ).toBe(true);

    expect(
      updateRenderJobSchema.safeParse({ status: "completed", fromStatus: "rendering" }).success,
    ).toBe(true);
  });

  it("updateRenderJobSchema: rejects forbidden transitions", () => {
    const res = updateRenderJobSchema.safeParse({ status: "completed", fromStatus: "pending" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain("pending -> completed");
    }
  });

  it("updateRenderJobSchema: if fromStatus omitted, does not enforce transition", () => {
    expect(updateRenderJobSchema.safeParse({ status: "completed" }).success).toBe(true);
  });

  it("updateRenderJobSchema: strict rejects unknown keys", () => {
    const res = updateRenderJobSchema.safeParse({ status: "pending", extra: 1 });
    expect(res.success).toBe(false);
  });
});

