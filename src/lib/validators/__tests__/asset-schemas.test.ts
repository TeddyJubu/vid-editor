import { describe, expect, it } from "vitest";

import {
  acceptedAssetMimeTypes,
  createAssetSchema,
  isAcceptedAssetMimeType,
} from "@/lib/validators/asset-schemas";

describe("asset-schemas", () => {
  const projectId = "00000000-0000-4000-8000-000000000000";

  it("isAcceptedAssetMimeType: true for all accepted mime types", () => {
    for (const mt of acceptedAssetMimeTypes) {
      expect(isAcceptedAssetMimeType(mt)).toBe(true);
    }
    expect(isAcceptedAssetMimeType("application/json")).toBe(false);
  });

  it("createAssetSchema: accepts valid asset", () => {
    const out = createAssetSchema.parse({
      filename: "video.mp4",
      mimeType: "video/mp4",
      sizeBytes: 123,
      projectId,
    });
    expect(out.filename).toBe("video.mp4");
  });

  it("createAssetSchema: rejects path traversal in filename", () => {
    expect(
      createAssetSchema.safeParse({
        filename: "../video.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1,
        projectId,
      }).success,
    ).toBe(false);

    expect(
      createAssetSchema.safeParse({
        filename: "foo\\bar.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1,
        projectId,
      }).success,
    ).toBe(false);
  });

  it("createAssetSchema: enforces filename extension and mime/ext match", () => {
    const missingExt = createAssetSchema.safeParse({
      filename: "video",
      mimeType: "video/mp4",
      sizeBytes: 1,
      projectId,
    });
    expect(missingExt.success).toBe(false);

    const mismatch = createAssetSchema.safeParse({
      filename: "video.mp4",
      mimeType: "video/webm",
      sizeBytes: 1,
      projectId,
    });
    expect(mismatch.success).toBe(false);
  });

  it("createAssetSchema: rejects too-large files (> 500MB)", () => {
    const tooLarge = 500 * 1024 * 1024 + 1;
    const res = createAssetSchema.safeParse({
      filename: "video.mp4",
      mimeType: "video/mp4",
      sizeBytes: tooLarge,
      projectId,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message.includes("<= 500MB"))).toBe(true);
    }
  });

  it("createAssetSchema: accepts uppercase extension (normalized)", () => {
    const res = createAssetSchema.safeParse({
      filename: "PHOTO.JPG",
      mimeType: "image/jpeg",
      sizeBytes: 1,
      projectId,
    });
    expect(res.success).toBe(true);
  });

  it("createAssetSchema: rejects unsupported mimeType", () => {
    const res = createAssetSchema.safeParse({
      filename: "file.mp4",
      mimeType: "application/json" as never,
      sizeBytes: 1,
      projectId,
    });
    expect(res.success).toBe(false);
  });
});

