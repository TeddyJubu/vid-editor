import { z } from "zod";

import type { CreditEventType, PlanId } from "@/lib/types/credit";

export const planIdSchema = z
  .enum(["starter", "pro", "team"], { message: "Invalid planId" })
  .transform((v) => v as PlanId);

export const checkoutRequestSchema = z
  .object({
    planId: planIdSchema,
  })
  .strict();

export const creditBalanceResponseSchema = z
  .object({
    balance_ru: z.number().int(),
    updated_at: z.string().min(1),
  })
  .strict();

export const creditEventTypeSchema = z
  .enum([
    "subscription_grant",
    "render_debit",
    "render_refund",
    "overage_charge",
    "manual_adjustment",
  ])
  .transform((v) => v as CreditEventType);

export const creditEventSchema = z
  .object({
    id: z.string().uuid(),
    type: creditEventTypeSchema,
    delta_ru: z.number().int(),
    render_job_id: z.string().uuid().nullable(),
    description: z.string().nullable(),
    created_at: z.string().min(1),
  })
  .strict();

export const creditHistoryResponseSchema = z
  .object({
    events: z.array(creditEventSchema),
    total: z.number().int(),
  })
  .strict();
