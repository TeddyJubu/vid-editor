import { z } from "zod";

import type {
  CaptionJob,
  CaptionJobStatus,
  CaptionSegment,
  CaptionStyle,
} from "@/lib/types/caption";

const captionStyleSchema = z
  .enum(["word_by_word", "sentence", "paragraph"], {
    message: "Invalid style",
  })
  .transform((v) => v as CaptionStyle);

export const generateCaptionsSchema = z
  .object({
    projectId: z.string().uuid(),
    assetId: z.string().uuid().optional(),
    style: captionStyleSchema.optional(),
  })
  .strict()
  .transform((obj) => ({
    projectId: obj.projectId,
    assetId: obj.assetId,
    style: (obj.style ?? "sentence") as CaptionStyle,
  }));

const statusSchema = z
  .enum(["pending", "processing", "completed", "failed"], {
    message: "Invalid status",
  })
  .transform((v) => v as CaptionJobStatus);

const captionWordSchema = z
  .object({
    text: z.string(),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
  })
  .strict();

const captionSegmentSchema: z.ZodType<CaptionSegment> = z
  .object({
    text: z.string(),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    words: z.array(captionWordSchema).optional(),
  })
  .strict();

export const captionJobSchema: z.ZodType<CaptionJob> = z
  .object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    status: statusSchema,
    style: captionStyleSchema,
    result: z
      .object({
        segments: z.array(captionSegmentSchema),
      })
      .strict()
      .nullable(),
    error: z.string().nullable(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
  .strict();
