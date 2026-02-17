import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export async function getFirstWorkspaceIdForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.workspace_id ?? null;
}
