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

/**
 * Dev-only helper for DEV_NO_AUTH mode.
 *
 * - If DEV_WORKSPACE_ID is provided, use it.
 * - Otherwise, pick the first workspace; if none exists, create one.
 *
 * IMPORTANT: Call this only with a privileged client (e.g. service-role) since
 * RLS policies require authenticated membership for normal clients.
 */
export async function getOrCreateDevWorkspaceId(
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const explicit = process.env.DEV_WORKSPACE_ID;
  if (explicit) return explicit;

  const { data: existing, error: selectError } = await supabase
    .from("workspaces")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  if (existing?.id) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from("workspaces")
    .insert({ name: "Dev Workspace" })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);
  return created.id;
}
