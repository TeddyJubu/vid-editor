import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import { getRenderJob } from "@/lib/services/render-service";
import { processNow } from "@/lib/render/render-queue";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function POST(
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

  const existing = await getRenderJob(jobId, workspaceId);
  if (!existing) return jsonError("Not Found", 404);
  if (existing.job.status !== "pending") {
    return jsonError("Render job is not pending", 409);
  }

  try {
    await processNow(jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Render failed";
    if (msg.toLowerCase().includes("capacity")) {
      return jsonError(msg, 429);
    }
    return jsonError(msg, 500);
  }

  const updated = await getRenderJob(jobId, workspaceId);
  if (!updated) return jsonError("Not Found", 404);
  return jsonData(updated);
}
