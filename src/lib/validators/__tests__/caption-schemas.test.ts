import { describe, expect, it } from "vitest";

import { generateCaptionsSchema } from "@/lib/validators/caption-schemas";

describe("caption-schemas", () => {
  const projectId = "00000000-0000-4000-8000-000000000000";
  const assetId = "00000000-0000-4000-8000-000000000001";

  it("generateCaptionsSchema: accepts valid input", () => {
    const out = generateCaptionsSchema.parse({ projectId, assetId, style: "word_by_word" });
    expect(out).toEqual({ projectId, assetId, style: "word_by_word" });
  });

  it("generateCaptionsSchema: applies default style when omitted", () => {
    const out = generateCaptionsSchema.parse({ projectId });
    expect(out.style).toBe("sentence");
  });

  it("generateCaptionsSchema: rejects missing/invalid projectId", () => {
    expect(generateCaptionsSchema.safeParse({}).success).toBe(false);
    expect(generateCaptionsSchema.safeParse({ projectId: "nope" }).success).toBe(false);
  });

  it("generateCaptionsSchema: rejects invalid style", () => {
    const res = generateCaptionsSchema.safeParse({ projectId, style: "weird" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message.includes("Invalid style"))).toBe(true);
    }
  });

  it("generateCaptionsSchema: strict rejects unknown keys", () => {
    const res = generateCaptionsSchema.safeParse({ projectId, extra: 1 });
    expect(res.success).toBe(false);
  });
});

