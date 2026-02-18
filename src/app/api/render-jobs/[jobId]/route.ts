import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import { getRenderJob, updateRenderJobStatus } from "@/lib/services/render-service";
import { updateRenderJobSchema } from "@/lib/validators/render-schemas";
import { creditAmount } from "@/lib/services/credit-service";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);
  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  const result = await getRenderJob(jobId, workspaceId);
  if (!result) return jsonError("Not Found", 404);
  return jsonData(result);
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);
  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  const existing = await getRenderJob(jobId, workspaceId);
  if (!existing) return jsonError("Not Found", 404);

  try {
    const payload = await request.json();
    const body = updateRenderJobSchema.parse({
      ...(payload as Record<string, unknown>),
      fromStatus: existing.job.status,
    });

    const updates: {
      status: typeof body.status;
      error_message?: string | null;
      actual_ru?: number | null;
      started_at?: string | null;
      completed_at?: string | null;
    } = { status: body.status };

    if (body.errorMessage !== undefined) updates.error_message = body.errorMessage;
    if (body.actualRu !== undefined) updates.actual_ru = body.actualRu;
    if (body.startedAt !== undefined) updates.started_at = body.startedAt;
    if (body.completedAt !== undefined) updates.completed_at = body.completedAt;

    const updated = await updateRenderJobStatus(jobId, updates);
    if (!updated) return jsonError("Not Found", 404);

		// Refund estimated RU if the render transitions to failed.
		if (existing.job.status === "rendering" && body.status === "failed") {
			const estimated =
				typeof existing.job.estimated_ru === "number" && Number.isFinite(existing.job.estimated_ru)
					? Math.max(0, Math.trunc(existing.job.estimated_ru))
					: 0;
			if (estimated > 0) {
				await creditAmount(workspaceId, estimated, "render_refund", {
					renderJobId: jobId,
					description: "Render failed refund",
				});
			}
		}

    return jsonData({ job: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues.map((i) => i.message).join("; "), 400);
    }
    return jsonError(err instanceof Error ? err.message : "Bad Request", 400);
  }
}
