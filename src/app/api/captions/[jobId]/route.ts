import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import { getCaptionJob } from "@/lib/services/caption-service";

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

  // Maintain the repo's standard workspace guard (even though jobs are in-memory).
  const hasWorkspace = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!hasWorkspace) return jsonError("Forbidden", 403);

  const job = getCaptionJob(jobId);
  if (!job) return jsonError("Not Found", 404);

  return jsonData({
    id: job.id,
    status: job.status,
    style: job.style,
    result: job.status === "completed" ? job.result : null,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
}
