import { createClient } from "@/lib/supabase/server";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randInt(min: number, max: number): number {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function shouldSimulateFailure(projectJson: unknown): boolean {
  if (!projectJson || typeof projectJson !== "object") return false;
  const obj = projectJson as Record<string, unknown>;
  if (obj.__simulateRenderFailure === true) return true;
  const render = obj.render;
  if (render && typeof render === "object") {
    const r = render as Record<string, unknown>;
    if (r.simulateFailure === true) return true;
    const failRate = typeof r.failRate === "number" ? r.failRate : null;
    if (failRate !== null && Number.isFinite(failRate) && failRate > 0) {
      return Math.random() < Math.min(Math.max(failRate, 0), 1);
    }
  }
  return false;
}

export type StubRenderResult = {
  storageKey: string;
  format: "mp4";
  sizeBytes: number;
};

/**
 * Stub/mock server-side render worker.
 * Simulates processing time and returns a placeholder storage key.
 */
export async function processRenderJob(
  jobId: string,
  projectJson: unknown,
): Promise<StubRenderResult> {
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("render_jobs")
    .select("workspace_id")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!job?.workspace_id) throw new Error("Render job not found");

  // Simulate processing time.
  await sleep(randInt(2000, 5000));

  if (shouldSimulateFailure(projectJson)) {
    throw new Error("Simulated render failure");
  }

  const storageKey = `renders/${job.workspace_id}/${jobId}/output.mp4`;
  // No real rendering for MVP; use a small-ish fake size.
  const sizeBytes = randInt(200_000, 2_000_000);

  return { storageKey, format: "mp4", sizeBytes };
}
