import { NextResponse, type NextRequest } from "next/server";

import {
  getRenderOutputByShareToken,
  getSignedDownloadUrl,
} from "@/lib/services/render-output-service";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ shareToken: string }> },
) {
  const { shareToken } = await ctx.params;
  if (!shareToken) return jsonError("Not Found", 404);

  const output = await getRenderOutputByShareToken(shareToken);
  if (!output) return jsonError("Not Found", 404);

  const signedUrl = await getSignedDownloadUrl(output.storage_key);
  return jsonData({ output, signedUrl });
}

