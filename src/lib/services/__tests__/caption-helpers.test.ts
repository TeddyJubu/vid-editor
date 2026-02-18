import { beforeAll, describe, expect, it, vi } from "vitest";

// caption-service imports server-only helpers that pull in Next modules.
// We don't call them in these tests, but mocking avoids accidental runtime coupling.
vi.mock("next/headers", () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => undefined,
  }),
}));

type CaptionHelpers = typeof import("../caption-service");
let h: CaptionHelpers;

beforeAll(async () => {
  h = await import("../caption-service");
});

function expectSegmentsCoverTotal(segments: { startMs: number; endMs: number }[], totalMs: number) {
  expect(segments.length).toBeGreaterThan(0);
  expect(segments[0]!.startMs).toBe(0);
  expect(segments[segments.length - 1]!.endMs).toBe(totalMs);
  for (let i = 0; i < segments.length; i += 1) {
    const cur = segments[i]!;
    expect(cur.endMs).toBeGreaterThan(cur.startMs);
    if (i > 0) {
      const prev = segments[i - 1]!;
      expect(cur.startMs).toBe(prev.endMs);
    }
  }
}

describe("caption-service helpers", () => {
  describe("stripCodeFences", () => {
    it("returns plain trimmed text", () => {
      expect(h.stripCodeFences("  hello  ")).toBe("hello");
    });

    it("strips fenced JSON with language tag", () => {
      expect(h.stripCodeFences("```json\n[1,2]\n```\n")).toBe("[1,2]");
		      expect(h.stripCodeFences("```JSON\n{\"a\":1}\n```"))
		        .toBe("{\"a\":1}");
    });

    it("strips fenced content without language tag", () => {
	      expect(h.stripCodeFences("```\n {\"a\":1} \n```"))
	        .toBe("{\"a\":1}");
    });
  });

  describe("extractLikelyJsonArray", () => {
    it("extracts a valid JSON array from fenced content", () => {
      const out = h.extractLikelyJsonArray("```json\n[{\"a\":1}]\n```");
      expect(JSON.parse(out)).toEqual([{ a: 1 }]);
    });

    it("throws when no brackets are present", () => {
      expect(() => h.extractLikelyJsonArray("no array here")).toThrow(/JSON array/i);
    });

    it("handles nested brackets inside the array", () => {
			      const out = h.extractLikelyJsonArray("```\n[{\"a\":[1,2]}]\n```");
      expect(JSON.parse(out)).toEqual([{ a: [1, 2] }]);
    });
  });

  describe("buildProjectContext", () => {
    it("returns minimal context for empty project", () => {
      expect(h.buildProjectContext(null, 1234)).toEqual({ durationMs: 1234 });
    });

    it("includes title, element type counts, and text samples", () => {
      const ctx = h.buildProjectContext(
        {
          title: "My Project",
          elements: [
            { type: "text", text: "  hi  " },
            { type: "image", name: "  Img  " },
            { text: "no type" },
          ],
        },
        5000,
      );
      expect(ctx.title).toBe("My Project");
      expect(ctx.elementTypeCounts).toEqual({ text: 1, image: 1, unknown: 1 });
      expect(ctx.textSamples).toEqual(["hi", "Img", "no type"]);
    });

    it("falls back to name when title is missing and caps text samples", () => {
      const elements = Array.from({ length: 20 }, (_, i) => ({ type: "text", text: `t${i}` }));
      const ctx = h.buildProjectContext({ name: "N", elements }, 1000);
      expect(ctx.title).toBe("N");
      expect(ctx.textSamples?.length).toBe(12);
      expect(ctx.textSamples?.[0]).toBe("t0");
      expect(ctx.textSamples?.[11]).toBe("t11");
    });
  });

  describe("toIntMs", () => {
    it("parses numbers and numeric strings, truncating", () => {
      expect(h.toIntMs(12.9)).toBe(12);
      expect(h.toIntMs("12.9")).toBe(12);
      expect(h.toIntMs(-5.2)).toBe(-5);
    });

    it("returns null for NaN/Infinity/non-numeric", () => {
      expect(h.toIntMs("nope")).toBeNull();
      expect(h.toIntMs(Number.NaN)).toBeNull();
      expect(h.toIntMs(Number.POSITIVE_INFINITY)).toBeNull();
    });
  });

  describe("validateAndNormalizeSegments", () => {
    it("normalizes and sorts valid segments", () => {
      const out = h.validateAndNormalizeSegments(
        [
          { text: "b", startMs: 100, endMs: 200 },
          { text: "a", startMs: 0, endMs: 50 },
        ],
        1000,
        "sentence",
      );
      expect(out.map((s) => s.text)).toEqual(["a", "b"]);
      expect(out[0]!.startMs).toBe(0);
    });

    it("throws for missing fields or invalid timing", () => {
      expect(() => h.validateAndNormalizeSegments([{ startMs: 0, endMs: 1 }], 1000, "sentence")).toThrow(
        /Missing text/i,
      );
      expect(() => h.validateAndNormalizeSegments([{ text: "x", startMs: 5, endMs: 5 }], 1000, "sentence")).toThrow(
        /Invalid timing/i,
      );
      expect(() => h.validateAndNormalizeSegments([{ text: "x", startMs: "no", endMs: 10 }], 1000, "sentence")).toThrow(
        /Missing startMs\/endMs/i,
      );
    });

    it("supports word_by_word with explicit words", () => {
      const out = h.validateAndNormalizeSegments(
        [
          {
            text: "hello",
            startMs: 0,
            endMs: 1000,
            words: [{ text: "hello", startMs: -10, endMs: 100 }],
          },
        ],
        1000,
        "word_by_word",
      );
      expect(out[0]!.words?.[0]).toEqual({ text: "hello", startMs: 0, endMs: 100 });
    });

    it("derives words when style is word_by_word and words[] is missing", () => {
      const out = h.validateAndNormalizeSegments(
        [{ text: "hello world", startMs: 0, endMs: 1000 }],
        500,
        "word_by_word",
      );
      expect(out[0]!.words?.length).toBe(2);
      expect(out[0]!.words?.[0]!.startMs).toBe(0);
      expect(out[0]!.words?.[1]!.endMs).toBe(1000);
    });
  });

  describe("generateMockCaptions", () => {
    it("generates sentence captions that span duration", () => {
      const totalMs = 12_000;
      const segs = h.generateMockCaptions(totalMs, "sentence");
      expectSegmentsCoverTotal(segs, totalMs);
      expect(segs.some((s) => s.words)).toBe(false);
    });

    it("generates paragraph captions that span duration", () => {
      const totalMs = 25_000;
      const segs = h.generateMockCaptions(totalMs, "paragraph");
      expectSegmentsCoverTotal(segs, totalMs);
      expect(segs.some((s) => s.words)).toBe(false);
    });

    it("generates word_by_word captions with per-word timings", () => {
      const totalMs = 5500;
      const segs = h.generateMockCaptions(totalMs, "word_by_word");
      expectSegmentsCoverTotal(segs, totalMs);
      for (const s of segs) {
        expect(s.words && s.words.length > 0).toBe(true);
        expect(s.text).toBe(s.words!.map((w) => w.text).join(" "));
        for (const w of s.words!) {
          expect(w.startMs).toBeGreaterThanOrEqual(s.startMs);
          expect(w.endMs).toBeLessThanOrEqual(s.endMs);
          expect(w.endMs).toBeGreaterThan(w.startMs);
        }
      }
    });
  });
});
