import { describe, expect, it } from "vitest";

import { estimateRenderUnits } from "../browser-render";

describe("browser-render helpers", () => {
  describe("estimateRenderUnits", () => {
    it("uses defaults for empty project", () => {
      expect(estimateRenderUnits(null, "draft")).toBe(10);
      expect(estimateRenderUnits(null, "standard")).toBe(14);
      expect(estimateRenderUnits(null, "pro")).toBe(18);
      expect(estimateRenderUnits(null, "ultra")).toBe(25);
    });

    it("increases with higher tiers", () => {
      const d = estimateRenderUnits(null, "draft");
      const s = estimateRenderUnits(null, "standard");
      const p = estimateRenderUnits(null, "pro");
      const u = estimateRenderUnits(null, "ultra");
      expect(d).toBeLessThan(s);
      expect(s).toBeLessThan(p);
      expect(p).toBeLessThan(u);
    });

    it("handles edge cases (zero duration)", () => {
      // extractDurationSeconds => 10 default because maxEndMs=0 -> seconds=0 -> default 10.
      // So ensure we actually create a zero-duration by giving empty elements.
      expect(estimateRenderUnits({ elements: [] }, "draft")).toBe(10);
    });

    it("accounts for duration, resolution, and fps", () => {
      const projectJson = {
        format: { width: 1920, height: 1080, fps: 60 },
        elements: [{ startMs: 0, durationMs: 2000 }],
      };
      // durationSeconds = 2
      // fpsFactor = 60/30 = 2
      // pixelFactor = (1920*1080)/921600 = 2.25
      // draft mult = 1 => ceil(2*2*2.25) = ceil(9) = 9
      expect(estimateRenderUnits(projectJson, "draft")).toBe(9);
    });
  });
});
