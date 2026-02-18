import { z } from "zod";

import type { RenderJobStatus, RenderTier } from "@/lib/services/render-service";

export const renderTierSchema = z
  .enum(["draft", "standard", "pro", "ultra"], { message: "Invalid tier" })
  .transform((v) => v as RenderTier);

export const createRenderJobSchema = z
  .object({
    projectVersionId: z.string().uuid(),
    tier: renderTierSchema,
    projectJson: z.record(z.string(), z.any()),
  })
  .strict();

const statusSchema = z
  .enum(["pending", "rendering", "completed", "failed"], { message: "Invalid status" })
  .transform((v) => v as RenderJobStatus);

const allowedTransitions: Record<RenderJobStatus, RenderJobStatus[]> = {
  pending: ["pending", "rendering", "failed"],
  rendering: ["rendering", "completed", "failed"],
  completed: ["completed"],
  failed: ["failed"],
};

export const updateRenderJobSchema = z
  .object({
    status: statusSchema,
    fromStatus: statusSchema.optional(),
    errorMessage: z.string().trim().max(5000).nullable().optional(),
    actualRu: z.number().int().min(0).nullable().optional(),
    startedAt: z.string().datetime().nullable().optional(),
    completedAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .superRefine((obj, ctx) => {
    if (!obj.fromStatus) return;
    const allowed = allowedTransitions[obj.fromStatus] ?? [];
    if (!allowed.includes(obj.status)) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: `Invalid status transition: ${obj.fromStatus} -> ${obj.status}`,
      });
    }
  });
