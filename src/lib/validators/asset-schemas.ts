import { z } from "zod";

export const acceptedAssetMimeTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
] as const;

export type AcceptedAssetMimeType = (typeof acceptedAssetMimeTypes)[number];

export function isAcceptedAssetMimeType(v: string): v is AcceptedAssetMimeType {
  return (acceptedAssetMimeTypes as readonly string[]).includes(v);
}

const maxBytes = 500 * 1024 * 1024;

const extByMimeType: Record<AcceptedAssetMimeType, string[]> = {
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov", ".qt"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/svg+xml": [".svg"],
  "audio/mpeg": [".mp3", ".mpeg"],
  "audio/wav": [".wav"],
  "audio/ogg": [".ogg"],
  "audio/aac": [".aac"],
};

function getLowerExt(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx).toLowerCase();
}

export const createAssetSchema = z
  .object({
    filename: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine((v) => !v.includes("/") && !v.includes("\\"), {
        message: "Invalid filename",
      }),
    mimeType: z.enum(acceptedAssetMimeTypes, { message: "Unsupported mimeType" }),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(maxBytes, { message: "File must be <= 500MB" }),
    projectId: z.string().uuid(),
    width: z.number().int().positive().max(16384).optional(),
    height: z.number().int().positive().max(16384).optional(),
    durationSeconds: z.number().positive().max(60 * 60 * 24).optional(),
  })
  .strict()
  .superRefine((obj, ctx) => {
    const ext = getLowerExt(obj.filename);
    if (!ext) {
      ctx.addIssue({ code: "custom", path: ["filename"], message: "Missing file extension" });
      return;
    }
    const allowedForMime = extByMimeType[obj.mimeType];
    if (!allowedForMime.includes(ext)) {
      ctx.addIssue({
        code: "custom",
        path: ["filename"],
        message: `File extension does not match mimeType (${obj.mimeType})`,
      });
    }
  });
