import { describe, expect, it } from "vitest";

import {
  createProjectSchema,
  saveVersionSchema,
  updateProjectSchema,
} from "@/lib/validators/project-schemas";

describe("project-schemas", () => {
  it("createProjectSchema: accepts title variant", () => {
    const out = createProjectSchema.parse({
      title: "My Project",
      formatPresetId: "landscape_16_9",
    });
    expect(out).toEqual({ title: "My Project", formatPresetId: "landscape_16_9" });
  });

  it("createProjectSchema: accepts name variant and maps to title", () => {
    const out = createProjectSchema.parse({
      name: "My Project",
      formatPresetId: "landscape_16_9",
    });
    expect(out).toEqual({ title: "My Project", formatPresetId: "landscape_16_9" });
  });

  it("createProjectSchema: rejects missing title/name", () => {
    const res = createProjectSchema.safeParse({ formatPresetId: "landscape_16_9" });
    expect(res.success).toBe(false);
  });

  it("createProjectSchema: rejects too-long title", () => {
    const res = createProjectSchema.safeParse({
      title: "a".repeat(101),
      formatPresetId: "landscape_16_9",
    });
    expect(res.success).toBe(false);
  });

  it("createProjectSchema: rejects invalid formatPresetId", () => {
    const res = createProjectSchema.safeParse({ title: "x", formatPresetId: "nope" });
    expect(res.success).toBe(false);
  });

  it("updateProjectSchema: requires at least one field", () => {
    const res = updateProjectSchema.safeParse({});
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message.includes("At least one field"))).toBe(true);
    }
  });

  it("updateProjectSchema: accepts title", () => {
    const out = updateProjectSchema.parse({ title: "New Title" });
    expect(out).toEqual({ title: "New Title" });
  });

  it("updateProjectSchema: accepts name and maps to title", () => {
    const out = updateProjectSchema.parse({ name: "New Name" });
    expect(out).toEqual({ title: "New Name" });
  });

  it("updateProjectSchema: if both name and title provided, name wins", () => {
    const out = updateProjectSchema.parse({ name: "Name", title: "Title" });
    expect(out).toEqual({ title: "Name" });
  });

  it("updateProjectSchema: strict rejects unknown keys", () => {
    const res = updateProjectSchema.safeParse({ title: "x", extra: 1 });
    expect(res.success).toBe(false);
  });

  it("saveVersionSchema: accepts minimal valid input", () => {
    const out = saveVersionSchema.parse({ projectJson: { foo: "bar" } });
    expect(out).toEqual({ projectJson: { foo: "bar" } });
  });

  it("saveVersionSchema: trims label and rejects blank label", () => {
    const out = saveVersionSchema.parse({ projectJson: {}, label: "  v1  " });
    expect(out.label).toBe("v1");

    const bad = saveVersionSchema.safeParse({ projectJson: {}, label: "   " });
    expect(bad.success).toBe(false);
  });
});

