import { z } from "zod";

import { isFormatPresetId, type FormatPresetId } from "@/lib/presets";

const formatPresetIdSchema = z
  .string()
  .refine((v) => isFormatPresetId(v), { message: "Invalid formatPresetId" })
  .transform((v) => v as FormatPresetId);

export const createProjectSchema = z
  .union([
    z
      .object({
        title: z.string().trim().min(1).max(100),
        formatPresetId: formatPresetIdSchema,
      })
      .strict()
      .transform((v) => ({ title: v.title, formatPresetId: v.formatPresetId })),
    z
      .object({
        name: z.string().trim().min(1).max(100),
        formatPresetId: formatPresetIdSchema,
      })
      .strict()
      .transform((v) => ({ title: v.name, formatPresetId: v.formatPresetId })),
  ]);

export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    thumbnailUrl: z.string().url().nullable().optional(),
    formatPresetId: formatPresetIdSchema.optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  })
  .transform((obj) => {
    const { name, title, ...rest } = obj;
    return {
      ...rest,
      title: name ?? title,
    };
  });

export const saveVersionSchema = z
  .object({
    projectJson: z.record(z.string(), z.any()),
    label: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
