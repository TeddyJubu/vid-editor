import { createClient } from "@/lib/supabase/server";
import {
  createRenderOutput,
  updateRenderJobStatus,
  type RenderJobRow,
} from "@/lib/services/render-service";
import { processRenderJob } from "@/lib/render/server-render";

type PendingJob = { jobId: string; enqueuedAt: number };

const CONCURRENCY_LIMIT = 2;
const pendingQueue: PendingJob[] = [];
const activeJobs = new Map<string, { startedAt: number }>();

export function enqueueRender(jobId: string) {
  if (activeJobs.has(jobId)) return;
  if (pendingQueue.some((j) => j.jobId === jobId)) return;
  pendingQueue.push({ jobId, enqueuedAt: Date.now() });
  pendingQueue.sort((a, b) => a.enqueuedAt - b.enqueuedAt);
}

export function getRenderQueueState() {
  return {
    pending: pendingQueue.map((j) => j.jobId),
    active: Array.from(activeJobs.keys()),
    concurrencyLimit: CONCURRENCY_LIMIT,
  };
}

async function fetchJobAndProjectJson(jobId: string): Promise<{
  job: Pick<RenderJobRow, "project_version_id" | "estimated_ru">;
  projectJson: unknown;
}> {
  const supabase = await createClient();
  const { data: job, error: jobError } = await supabase
    .from("render_jobs")
    .select("project_version_id,estimated_ru")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) throw new Error(jobError.message);
  if (!job) throw new Error("Render job not found");

  const { data: version, error: versionError } = await supabase
    .from("project_versions")
    .select("project_json")
    .eq("id", job.project_version_id)
    .maybeSingle();

  if (versionError) throw new Error(versionError.message);
  if (!version) throw new Error("Project version not found");

  return {
    job,
    projectJson: version.project_json,
  };
}

async function processJob(jobId: string): Promise<void> {
  const startedAtIso = new Date().toISOString();
  await updateRenderJobStatus(jobId, { status: "rendering", started_at: startedAtIso });

  const { job, projectJson } = await fetchJobAndProjectJson(jobId);

  try {
    const result = await processRenderJob(jobId, projectJson);
    const output = await createRenderOutput(jobId, result.storageKey, result.format, result.sizeBytes);

    const completedAtIso = new Date().toISOString();
    await updateRenderJobStatus(jobId, {
      status: "completed",
      actual_ru: job.estimated_ru,
      completed_at: completedAtIso,
      error_message: null,
    });

    void output;
  } catch (err) {
    const completedAtIso = new Date().toISOString();
    await updateRenderJobStatus(jobId, {
      status: "failed",
      error_message: err instanceof Error ? err.message : "Render failed",
      completed_at: completedAtIso,
    });
    throw err;
  }
}

/**
 * Processes the oldest pending job, respecting a concurrency limit.
 * Returns the processed jobId, or null if nothing started.
 */
export async function processNext(): Promise<string | null> {
  if (activeJobs.size >= CONCURRENCY_LIMIT) return null;
  const next = pendingQueue.shift();
  if (!next) return null;

  const { jobId } = next;
  activeJobs.set(jobId, { startedAt: Date.now() });
  try {
    await processJob(jobId);
    return jobId;
  } finally {
    activeJobs.delete(jobId);
  }
}

/**
 * Convenience for processing a specific job immediately (used by API /start).
 */
export async function processNow(jobId: string): Promise<void> {
  if (activeJobs.size >= CONCURRENCY_LIMIT && !activeJobs.has(jobId)) {
    throw new Error("Render queue is at capacity");
  }
  if (activeJobs.has(jobId)) return;
  activeJobs.set(jobId, { startedAt: Date.now() });
  try {
    await processJob(jobId);
  } finally {
    activeJobs.delete(jobId);
  }
}
