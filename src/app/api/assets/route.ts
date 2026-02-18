import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import {
  createAssetRecord,
  getUploadUrl,
  listAssets,
} from "@/lib/services/asset-service";
import {
  isAcceptedAssetMimeType,
  createAssetSchema,
} from "@/lib/validators/asset-schemas";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

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
  const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;
  const mimeType = request.nextUrl.searchParams.get("mimeType") ?? undefined;

  if (projectId && !z.string().uuid().safeParse(projectId).success) {
    return jsonError("Invalid projectId", 400);
  }
  if (mimeType && !isAcceptedAssetMimeType(mimeType)) {
    return jsonError("Invalid mimeType", 400);
  }

  const { assets, count } = await listAssets(workspaceId, {
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
    projectId,
    mimeTypeFilter: mimeType,
  });

  return jsonData({ assets, count });
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
    const body = createAssetSchema.parse(await request.json());
    const { storageKey, uploadUrl } = await getUploadUrl(
      workspaceId,
      body.projectId,
      body.filename,
      body.mimeType,
    );

    const asset = await createAssetRecord(workspaceId, body.projectId, {
      filename: body.filename,
      storageKey,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      width: body.width,
      height: body.height,
      durationSeconds: body.durationSeconds,
    });

    return jsonData({ asset, storageKey, uploadUrl }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues.map((i) => i.message).join("; "), 400);
    }
    return jsonError(err instanceof Error ? err.message : "Bad Request", 400);
  }
}
