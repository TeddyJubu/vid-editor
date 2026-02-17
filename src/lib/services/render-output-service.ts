import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const RENDER_OUTPUTS_BUCKET = "assets" as const;

export type RenderJobRow = Database["public"]["Tables"]["render_jobs"]["Row"];
export type RenderOutputRow = Database["public"]["Tables"]["render_outputs"]["Row"];

export type RenderOutputWithJob = {
  output: RenderOutputRow;
  job: RenderJobRow;
};

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const ts = new Date(expiresAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return ts <= Date.now();
}

export async function getSignedDownloadUrl(storageKey: string): Promise<string> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(RENDER_OUTPUTS_BUCKET)
    .createSignedUrl(storageKey, 60 * 60);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Failed to create signed download URL");
  return data.signedUrl;
}

export async function getRenderOutput(
  outputId: string,
  workspaceId: string,
): Promise<RenderOutputWithJob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("render_outputs")
    .select("*, render_jobs!inner(*)")
    .eq("id", outputId)
    .eq("render_jobs.workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const rec = data as unknown as RenderOutputRow & { render_jobs: RenderJobRow };
  return { output: rec, job: rec.render_jobs };
}

export async function getRenderOutputByShareToken(
  shareToken: string,
): Promise<RenderOutputRow | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("render_outputs")
    .select("*")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const output = (data as unknown as RenderOutputRow | null) ?? null;
  if (!output) return null;
  if (isExpired(output.expires_at)) return null;
  return output;
}

export async function listRenderOutputs(
  workspaceId: string,
  options: { jobId?: string; limit?: number; offset?: number } = {},
): Promise<{ outputs: RenderOutputRow[]; count: number | null }> {
  const supabase = await createClient();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = supabase
    .from("render_outputs")
    .select("*, render_jobs!inner(workspace_id)", { count: "exact" })
    .eq("render_jobs.workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.jobId) query = query.eq("render_job_id", options.jobId);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<RenderOutputRow & { render_jobs?: unknown }>;
  const outputs = rows.map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { render_jobs: _ignored, ...rest } = r;
    return rest as RenderOutputRow;
  });

  return { outputs, count };
}

export async function deleteRenderOutput(
  outputId: string,
  workspaceId: string,
): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("render_outputs")
    .select("*, render_jobs!inner(workspace_id)")
    .eq("id", outputId)
    .eq("render_jobs.workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return false;

  const output = data as unknown as RenderOutputRow;

  const { error: storageError } = await admin.storage
    .from(RENDER_OUTPUTS_BUCKET)
    .remove([output.storage_key]);
  if (storageError) throw new Error(storageError.message);

  const { error: dbError } = await admin.from("render_outputs").delete().eq("id", outputId);
  if (dbError) throw new Error(dbError.message);

  return true;
}
