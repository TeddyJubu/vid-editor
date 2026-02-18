import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import { startCaptionJob } from "@/lib/services/caption-service";
import { generateCaptionsSchema } from "@/lib/validators/caption-schemas";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
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
    const body = generateCaptionsSchema.parse(await request.json());
    const job = await startCaptionJob(body.projectId, workspaceId, body.style);
    return jsonData({ jobId: job.id, status: job.status }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues.map((i) => i.message).join("; "), 400);
    }
    return jsonError(err instanceof Error ? err.message : "Bad Request", 400);
  }
}
