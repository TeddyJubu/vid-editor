import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import { listCreditEvents } from "@/lib/services/credit-service";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

const intSchema = z.coerce.number().int().min(0);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);
  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  const limitRaw = request.nextUrl.searchParams.get("limit") ?? "20";
  const offsetRaw = request.nextUrl.searchParams.get("offset") ?? "0";

  const limitParsed = intSchema.safeParse(limitRaw);
  const offsetParsed = intSchema.safeParse(offsetRaw);
  if (!limitParsed.success) return jsonError("Invalid limit", 400);
  if (!offsetParsed.success) return jsonError("Invalid offset", 400);

  const { events, total } = await listCreditEvents(workspaceId, {
    limit: Math.min(Math.max(limitParsed.data, 1), 100),
    offset: offsetParsed.data,
  });

  return jsonData({ events, total });
}
