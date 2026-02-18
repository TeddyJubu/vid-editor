import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isDevNoAuthMode } from "@/lib/dev/no-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getFirstWorkspaceIdForUser,
  getOrCreateDevWorkspaceId,
} from "@/lib/services/workspace-service";
import { createProjectSchema } from "@/lib/validators/project-schemas";
import { createProject, listProjects } from "@/lib/services/project-service";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function GET(request: NextRequest) {
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

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const search = request.nextUrl.searchParams.get("search") ?? undefined;

  const { projects, count } = await listProjects(workspaceId, {
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
    search,
  });

  return jsonData({ projects, count });
}

export async function POST(request: NextRequest) {
  const devNoAuth = isDevNoAuthMode();
  const supabase = devNoAuth ? createServiceRoleClient() : await createClient();

  let workspaceId: string;
  let userId: string;
  if (devNoAuth) {
    workspaceId = await getOrCreateDevWorkspaceId(supabase);
    userId = "dev-no-auth";
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return jsonError("Unauthorized", 401);
    userId = user.id;

    const ws = await getFirstWorkspaceIdForUser(supabase, user.id);
    if (!ws) return jsonError("Forbidden", 403);
    workspaceId = ws;
  }

  try {
    const body = createProjectSchema.parse(await request.json());
    const result = await createProject(
      workspaceId,
      body.title,
      body.formatPresetId,
      userId,
    );
    return jsonData(result, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues.map((i) => i.message).join("; "), 400);
    }
    return jsonError(err instanceof Error ? err.message : "Bad Request", 400);
  }
}
