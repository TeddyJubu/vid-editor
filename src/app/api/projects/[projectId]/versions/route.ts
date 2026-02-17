import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import {
  listProjectVersions,
  saveProjectVersion,
} from "@/lib/services/project-service";
import { saveVersionSchema } from "@/lib/validators/project-schemas";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);
  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  const versions = await listProjectVersions(projectId, workspaceId);
  if (!versions) return jsonError("Not Found", 404);
  return jsonData({ versions });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);
  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  try {
    const body = saveVersionSchema.parse(await request.json());
    const version = await saveProjectVersion(
      projectId,
      workspaceId,
      body.projectJson,
      body.label,
    );
    if (!version) return jsonError("Not Found", 404);
    return jsonData({ version }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues.map((i) => i.message).join("; "), 400);
    }
    return jsonError(err instanceof Error ? err.message : "Bad Request", 400);
  }
}
