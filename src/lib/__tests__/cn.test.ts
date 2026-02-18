import { describe, expect, it } from "vitest";

import { cn } from "@/lib/cn";

describe("cn()", () => {
  it("returns empty string when given no classes", () => {
    expect(cn()).toBe("");
  });

  it("returns a single class when given one", () => {
    expect(cn("btn")).toBe("btn");
  });

  it("joins multiple classes with spaces", () => {
    expect(cn("btn", "primary", "rounded")).toBe("btn primary rounded");
  });

  it("filters falsy values (null, undefined, false, empty string)", () => {
    expect(cn("a", null, undefined, false, "", "b")).toBe("a b");
  });
});
