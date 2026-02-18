import type { Database } from "@/types/database";

export type RenderTier = "draft" | "standard" | "pro" | "ultra";
export type RenderJobStatus = "pending" | "rendering" | "completed" | "failed";

export type RenderJob = Database["public"]["Tables"]["render_jobs"]["Row"];
export type RenderOutput = Database["public"]["Tables"]["render_outputs"]["Row"];
