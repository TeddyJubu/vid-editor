import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import {
  getRenderOutput,
  getSignedDownloadUrl,
} from "@/lib/services/render-output-service";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ outputId: string }> },
) {
  const { outputId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);
  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  const result = await getRenderOutput(outputId, workspaceId);
  if (!result) return jsonError("Not Found", 404);

  const signedUrl = await getSignedDownloadUrl(result.output.storage_key);
  return NextResponse.redirect(signedUrl, 302);
}

