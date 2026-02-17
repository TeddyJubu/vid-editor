import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import {
  deleteAsset,
  getAsset,
  getSignedDownloadUrl,
} from "@/lib/services/asset-service";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);
  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  const asset = await getAsset(assetId, workspaceId);
  if (!asset) return jsonError("Not Found", 404);

  const signedUrl = await getSignedDownloadUrl(asset.storage_key);
  return jsonData({ asset, signedUrl });
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);
  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  const ok = await deleteAsset(assetId, workspaceId);
  if (!ok) return jsonError("Not Found", 404);
  return jsonData({ success: true });
}
