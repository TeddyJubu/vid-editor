import { NextResponse, type NextRequest } from "next/server";

import { isDevNoAuthMode } from "@/lib/dev/no-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getFirstWorkspaceIdForUser,
  getOrCreateDevWorkspaceId,
} from "@/lib/services/workspace-service";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ projectId: string; versionId: string }> },
) {
  const { projectId, versionId } = await ctx.params;

  const devNoAuth = isDevNoAuthMode();
  const supabase = devNoAuth ? createServiceRoleClient() : await createClient();

  let workspaceId: string;
  if (devNoAuth) {
    workspaceId = await getOrCreateDevWorkspaceId(supabase);
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return jsonError("Unauthorized", 401);

    const ws = await getFirstWorkspaceIdForUser(supabase, user.id);
    if (!ws) return jsonError("Forbidden", 403);
    workspaceId = ws;
  }

  // Ensure the project is in this workspace, then fetch the version for that project.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (projectError) return jsonError(projectError.message, 400);
  if (!project) return jsonError("Not Found", 404);

  const { data: version, error: versionError } = await supabase
    .from("project_versions")
    .select("*")
    .eq("id", versionId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (versionError) return jsonError(versionError.message, 400);
  if (!version) return jsonError("Not Found", 404);

  return jsonData({ version });
}
