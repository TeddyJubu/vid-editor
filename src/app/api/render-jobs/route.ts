import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import { createRenderJob, listRenderJobs } from "@/lib/services/render-service";
import { createRenderJobSchema } from "@/lib/validators/render-schemas";
import { debitCredits } from "@/lib/services/credit-service";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

const statusQuerySchema = z.enum(["pending", "rendering", "completed", "failed"]);
const uuidSchema = z.string().uuid();

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorized", 401);

  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const statusParam = request.nextUrl.searchParams.get("status") ?? undefined;
  const projectIdParam = request.nextUrl.searchParams.get("projectId") ?? undefined;
  const includeOutputsParam = request.nextUrl.searchParams.get("includeOutputs") ?? undefined;
  const activeParam = request.nextUrl.searchParams.get("active") ?? undefined;

  if (statusParam && !statusQuerySchema.safeParse(statusParam).success) {
    return jsonError("Invalid status", 400);
  }

  if (projectIdParam && !uuidSchema.safeParse(projectIdParam).success) {
    return jsonError("Invalid projectId", 400);
  }

  const status = statusParam
    ? (statusParam as "pending" | "rendering" | "completed" | "failed")
    : undefined;

  const includeOutputs =
    includeOutputsParam === "1" ||
    includeOutputsParam === "true" ||
    includeOutputsParam === "yes";

  const active = activeParam === "1" || activeParam === "true" || activeParam === "yes";

  const { jobs, count } = await listRenderJobs(workspaceId, {
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
    status,
    projectId: projectIdParam,
    active,
  });

  if (!includeOutputs || jobs.length === 0) {
    return jsonData({ jobs, count });
  }

  const jobIds = jobs.map((j) => j.id).filter(Boolean);
  const { data: outputs, error: outputsError } = await supabase
    .from("render_outputs")
    .select("*")
    .in("render_job_id", jobIds)
    .order("created_at", { ascending: false });

  if (outputsError) return jsonError(outputsError.message, 400);

  const byJobId = new Map<string, unknown[]>();
  for (const o of outputs ?? []) {
    const jobId = (o as { render_job_id?: string }).render_job_id;
    if (!jobId) continue;
    const arr = byJobId.get(jobId) ?? [];
    arr.push(o as unknown);
    byJobId.set(jobId, arr);
  }

  const enriched = jobs.map((j) => ({
    ...j,
    outputs: (byJobId.get(j.id) ?? []) as unknown[],
  }));

  return jsonData({ jobs: enriched, count });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorized", 401);

  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  try {
    const body = createRenderJobSchema.parse(await request.json());

    // Ensure the version belongs to a project in this workspace.
    const { data: version, error: versionError } = await supabase
      .from("project_versions")
      .select("id,project_id")
      .eq("id", body.projectVersionId)
      .maybeSingle();

    if (versionError) return jsonError(versionError.message, 400);
    if (!version) return jsonError("Not Found", 404);

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", (version as { project_id: string }).project_id)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .maybeSingle();

    if (projectError) return jsonError(projectError.message, 400);
    if (!project) return jsonError("Not Found", 404);

    const result = await createRenderJob(
      workspaceId,
      body.projectVersionId,
      body.tier,
      body.projectJson,
    );

		// Debit estimated RU on job creation. Overage is allowed (negative balance).
		try {
			await debitCredits(
				workspaceId,
				result.estimatedRu,
				result.job.id,
				`Render debit (${body.tier})`,
			);
		} catch (err) {
			// Best-effort cleanup if debiting fails.
			await supabase.from("render_jobs").delete().eq("id", result.job.id);
			throw err;
		}

    return jsonData({ job: result.job, estimatedRu: result.estimatedRu }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues.map((i) => i.message).join("; "), 400);
    }
    return jsonError(err instanceof Error ? err.message : "Bad Request", 400);
  }
}

