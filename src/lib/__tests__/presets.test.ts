import { describe, expect, it } from "vitest";

import {
  FORMAT_PRESETS,
  getFormatPresetById,
  isFormatPresetId,
} from "@/lib/presets";

describe("presets", () => {
  it("has unique preset IDs", () => {
    const ids = FORMAT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("treats all FORMAT_PRESETS ids as valid", () => {
    for (const p of FORMAT_PRESETS) {
      expect(isFormatPresetId(p.id)).toBe(true);
    }
  });

  it("returns false for unknown preset IDs", () => {
    expect(isFormatPresetId("not_a_preset")).toBe(false);
  });

  it("getFormatPresetById returns the preset for known IDs", () => {
    const id = "landscape_16_9" as const;
    const p = getFormatPresetById(id);
    expect(p).toBeDefined();
    expect(p?.id).toBe(id);
    expect(p?.width).toBe(1920);
    expect(p?.height).toBe(1080);
  });

  it("getFormatPresetById returns undefined for unknown IDs at runtime", () => {
    expect(getFormatPresetById("nope" as any)).toBeUndefined();
  });

  it("contains a 'custom' preset with null width/height/fps", () => {
    const custom = getFormatPresetById("custom");
    expect(custom).toBeDefined();
    expect(custom?.width).toBeNull();
    expect(custom?.height).toBeNull();
    expect(custom?.fps).toBeNull();
  });

  it("all presets have required fields populated", () => {
    for (const p of FORMAT_PRESETS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.aspectRatioLabel.length).toBeGreaterThan(0);
      if (p.width != null) expect(p.width).toBeGreaterThan(0);
      if (p.height != null) expect(p.height).toBeGreaterThan(0);
      if (p.fps != null) expect(p.fps).toBeGreaterThan(0);
    }
  });
});
