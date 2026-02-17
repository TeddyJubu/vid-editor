import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getFirstWorkspaceIdForUser } from "@/lib/services/workspace-service";
import { getBalance, getSubscription } from "@/lib/services/credit-service";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);
  const workspaceId = await getFirstWorkspaceIdForUser(supabase, user.id);
  if (!workspaceId) return jsonError("Forbidden", 403);

  const balance = await getBalance(workspaceId);
  const subscription = await getSubscription(workspaceId);

  return jsonData({
    balance_ru: balance.balanceRu,
    updated_at: balance.updatedAt,
    subscription,
  });
}
