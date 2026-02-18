import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatRelativeTime } from "@/lib/format-time";

describe("formatRelativeTime()", () => {
  const NOW = new Date("2026-06-15T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string for invalid input", () => {
    expect(formatRelativeTime("not-a-date")).toBe("");
    expect(formatRelativeTime(new Date("invalid"))).toBe("");
  });

  it("returns 'just now' for current time and future times", () => {
    expect(formatRelativeTime(NOW)).toBe("just now");
    expect(formatRelativeTime(new Date(NOW.getTime() + 60_000))).toBe("just now");
  });

  it("formats seconds, minutes, and hours", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() - 29_000))).toBe("just now");
    expect(formatRelativeTime(new Date(NOW.getTime() - 30_000))).toBe("30 seconds ago");
    expect(formatRelativeTime(new Date(NOW.getTime() - 59_000))).toBe("59 seconds ago");

    expect(formatRelativeTime(new Date(NOW.getTime() - 60_000))).toBe("1 minute ago");
    expect(formatRelativeTime(new Date(NOW.getTime() - 2 * 60_000))).toBe("2 minutes ago");

    expect(formatRelativeTime(new Date(NOW.getTime() - 60 * 60_000))).toBe("1 hour ago");
    expect(formatRelativeTime(new Date(NOW.getTime() - 23 * 60 * 60_000))).toBe(
      "23 hours ago",
    );
  });

  it("returns 'yesterday' for 1 day ago", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() - 24 * 60 * 60_000))).toBe("yesterday");
  });

  it("formats older dates using Intl.DateTimeFormat (same year)", () => {
    const d = new Date(NOW.getTime() - 3 * 24 * 60 * 60_000);
    const expected = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(d);
    expect(formatRelativeTime(d)).toBe(expected);
  });

  it("includes year for older dates not in the current year", () => {
    const d = new Date("2025-06-15T12:00:00.000Z");
    const expected = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
    expect(formatRelativeTime(d)).toBe(expected);
  });
});
