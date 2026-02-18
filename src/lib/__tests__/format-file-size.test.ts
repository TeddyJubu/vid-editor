import { describe, expect, it } from "vitest";

import { formatFileSize } from "@/lib/format-file-size";

describe("formatFileSize()", () => {
  it("returns 0 B for non-finite, NaN, Infinity, or <= 0", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(-1)).toBe("0 B");
    expect(formatFileSize(Number.NaN)).toBe("0 B");
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe("0 B");
    expect(formatFileSize(Number.NEGATIVE_INFINITY)).toBe("0 B");
  });

  it("formats bytes (B) without decimals", () => {
    expect(formatFileSize(1)).toBe("1 B");
    expect(formatFileSize(1023)).toBe("1023 B");
    // function floors for B
    expect(formatFileSize(1023.9)).toBe("1023 B");
  });

  it("formats KB with one decimal (or no decimals >= 100)", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10 * 1024)).toBe("10.0 KB");
    expect(formatFileSize(100 * 1024)).toBe("100 KB");
  });

  it("formats MB / GB / TB", () => {
    expect(formatFileSize(1024 ** 2)).toBe("1.0 MB");
    expect(formatFileSize(1024 ** 3)).toBe("1.0 GB");
    expect(formatFileSize(1024 ** 4)).toBe("1.0 TB");
  });

  it("caps at TB for very large numbers", () => {
    expect(formatFileSize(1024 ** 5)).toBe("1024 TB");
  });
});
