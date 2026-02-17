import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

export type RenderTier = "draft" | "standard" | "pro" | "ultra";
export type RenderJobStatus = "pending" | "rendering" | "completed" | "failed";

export type RenderJobRow = Database["public"]["Tables"]["render_jobs"]["Row"];
export type RenderOutputRow = Database["public"]["Tables"]["render_outputs"]["Row"];

export type ListRenderJobsOptions = {
  status?: RenderJobStatus;
  active?: boolean;
  projectId?: string;
  limit?: number;
  offset?: number;
};

const qualityMultipliers: Record<RenderTier, number> = {
  draft: 1.0,
  standard: 1.35,
  pro: 1.8,
  ultra: 2.5,
};

function clampInt(v: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function extractDurationSeconds(projectJson: unknown): number {
  if (!projectJson || typeof projectJson !== "object") return 10;
  const obj = projectJson as Record<string, unknown>;
  const elements = obj.elements;
  if (!Array.isArray(elements) || elements.length === 0) return 10;
  let maxEndMs = 0;
  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const rec = el as Record<string, unknown>;
    const startMs = typeof rec.startMs === "number" ? rec.startMs : 0;
    const durationMs = typeof rec.durationMs === "number" ? rec.durationMs : 0;
    const endMs = startMs + durationMs;
    if (Number.isFinite(endMs) && endMs > maxEndMs) maxEndMs = endMs;
  }
  const seconds = maxEndMs / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 10;
}

function extractFormat(projectJson: unknown): { width: number; height: number; fps: number } {
  if (!projectJson || typeof projectJson !== "object") {
    return { width: 1920, height: 1080, fps: 30 };
  }
  const obj = projectJson as Record<string, unknown>;
  const fmt = obj.format;
  if (!fmt || typeof fmt !== "object") {
    return { width: 1920, height: 1080, fps: 30 };
  }
  const f = fmt as Record<string, unknown>;
  return {
    width: clampInt(typeof f.width === "number" ? f.width : 1920, 16, 16384),
    height: clampInt(typeof f.height === "number" ? f.height : 1080, 16, 16384),
    fps: Math.min(Math.max(typeof f.fps === "number" && Number.isFinite(f.fps) ? f.fps : 30, 1), 240),
  };
}

export function estimateRenderUnits(input: {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  tier: RenderTier;
}): number {
  const durationSeconds = Math.max(input.durationSeconds, 0);
  const fpsFactor = Math.max(input.fps, 1) / 30;
  const pixels = Math.max(input.width, 1) * Math.max(input.height, 1);
  const pixelFactor = pixels / 921_600; // 1280x720 baseline
  const mult = qualityMultipliers[input.tier] ?? 1.0;
  const ru = durationSeconds * fpsFactor * pixelFactor * mult;
  // RU columns are bigint; store an integer estimate.
  return Math.max(0, Math.ceil(ru));
}

export async function createRenderJob(
  workspaceId: string,
  projectVersionId: string,
  tier: RenderTier,
  projectJson: unknown,
): Promise<{ job: RenderJobRow; estimatedRu: number }> {
  const supabase = await createClient();
  const durationSeconds = extractDurationSeconds(projectJson);
  const { width, height, fps } = extractFormat(projectJson);
  const estimatedRu = estimateRenderUnits({ durationSeconds, width, height, fps, tier });

  const { data, error } = await supabase
    .from("render_jobs")
    .insert({
      workspace_id: workspaceId,
      project_version_id: projectVersionId,
      tier,
      duration_seconds: durationSeconds,
      width,
      height,
      fps,
      estimated_ru: estimatedRu,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return { job: data as unknown as RenderJobRow, estimatedRu };
}

export async function getRenderJob(
  jobId: string,
  workspaceId: string,
): Promise<{ job: RenderJobRow; outputs: RenderOutputRow[] } | null> {
  const supabase = await createClient();
  const { data: job, error: jobError } = await supabase
    .from("render_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (jobError) throw new Error(jobError.message);
  if (!job) return null;

  const { data: outputs, error: outputsError } = await supabase
    .from("render_outputs")
    .select("*")
    .eq("render_job_id", jobId)
    .order("created_at", { ascending: false });

  if (outputsError) throw new Error(outputsError.message);
  return {
    job: job as unknown as RenderJobRow,
    outputs: (outputs ?? []) as unknown as RenderOutputRow[],
  };
}

export async function listRenderJobs(
  workspaceId: string,
  options: ListRenderJobsOptions = {},
): Promise<{ jobs: RenderJobRow[]; count: number | null }> {
  const supabase = await createClient();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const select = options.projectId ? "*, project_versions!inner(project_id)" : "*";

  let query = supabase
    .from("render_jobs")
    .select(select, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.projectId) query = query.eq("project_versions.project_id", options.projectId);

  if (options.active) {
    query = query.in("status", ["pending", "rendering"]);
  } else if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const jobs = rows.map((row) => {
    if (options.projectId) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { project_versions: _pv, ...job } = row as Record<string, unknown> & {
        project_versions?: unknown;
      };
      return job as unknown as RenderJobRow;
    }
    return row as unknown as RenderJobRow;
  });

  return { jobs, count };
}

export async function updateRenderJobStatus(
  jobId: string,
  updates: {
    status: RenderJobStatus;
    error_message?: string | null;
    actual_ru?: number | null;
    started_at?: string | null;
    completed_at?: string | null;
  },
): Promise<RenderJobRow | null> {
  const supabase = await createClient();

  const payload: Database["public"]["Tables"]["render_jobs"]["Update"] = {
    status: updates.status,
  };
  if (updates.error_message !== undefined) payload.error_message = updates.error_message;
  if (updates.actual_ru !== undefined) payload.actual_ru = updates.actual_ru;
  if (updates.started_at !== undefined) payload.started_at = updates.started_at;
  if (updates.completed_at !== undefined) payload.completed_at = updates.completed_at;

  const { data, error } = await supabase
    .from("render_jobs")
    .update(payload)
    .eq("id", jobId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as unknown as RenderJobRow | null) ?? null;
}

export async function createRenderOutput(
  jobId: string,
  storageKey: string,
  format: string,
  sizeBytes: number,
): Promise<RenderOutputRow> {
  const supabase = await createClient();
  const shareToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("render_outputs")
    .insert({
      render_job_id: jobId,
      storage_key: storageKey,
      format,
      size_bytes: sizeBytes,
      share_token: shareToken,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as RenderOutputRow;
}
