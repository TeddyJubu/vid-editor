import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => undefined,
  }),
}));

type ServerRender = typeof import("../server-render");
let r: ServerRender;

beforeAll(async () => {
  r = await import("../server-render");
});

describe("server-render helpers", () => {
  describe("clampInt", () => {
    it("clamps/truncates normally", () => {
      expect(r.clampInt(12.9, 0, 100)).toBe(12);
      expect(r.clampInt(-5.1, 0, 100)).toBe(0);
    });

    it("returns min for NaN", () => {
      expect(r.clampInt(Number.NaN, 3, 9)).toBe(3);
    });

    it("clamps below min and above max", () => {
      expect(r.clampInt(-1, 10, 20)).toBe(10);
      expect(r.clampInt(999, 10, 20)).toBe(20);
    });
  });

  describe("extractDurationSeconds", () => {
    it("defaults when no elements", () => {
      expect(r.extractDurationSeconds(null)).toBe(10);
      expect(r.extractDurationSeconds({ elements: [] })).toBe(10);
    });

    it("calculates duration from elements", () => {
      expect(
        r.extractDurationSeconds({
          elements: [
            { startMs: 0, durationMs: 2500 },
            { startMs: 1000, durationMs: 1000 },
          ],
        }),
      ).toBe(2.5);
    });

    it("returns default for invalid/zero duration", () => {
      expect(r.extractDurationSeconds({ elements: [{ startMs: -100, durationMs: 0 }] })).toBe(10);
    });
  });

  describe("extractFormat", () => {
    it("defaults", () => {
      expect(r.extractFormat(null)).toEqual({ width: 1920, height: 1080, fps: 30 });
    });

    it("partial format", () => {
      expect(r.extractFormat({ format: { width: 100 } })).toEqual({ width: 100, height: 1080, fps: 30 });
    });

    it("full format with clamping", () => {
      expect(r.extractFormat({ format: { width: 1, height: 99999, fps: 999 } })).toEqual({
        width: 16,
        height: 16384,
        fps: 240,
      });
    });
  });

  describe("ensureEven", () => {
    it("keeps even values", () => {
      expect(r.ensureEven(10)).toBe(10);
    });

    it("rounds odd down to previous even", () => {
      expect(r.ensureEven(11)).toBe(10);
    });

    it("handles negative and zero", () => {
      expect(r.ensureEven(-5)).toBe(0);
      expect(r.ensureEven(0)).toBe(0);
    });
  });
});
