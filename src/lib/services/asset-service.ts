import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const ASSETS_BUCKET = "assets" as const;

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

export type CreateAssetMetadata = {
  filename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
};

function sanitizeFilename(filename: string): string {
  const base = filename
    .trim()
    .replace(/\\/g, "_")
    .replace(/\//g, "_")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return base || "file";
}

export async function createAssetRecord(
  workspaceId: string,
  projectId: string,
  metadata: CreateAssetMetadata,
): Promise<AssetRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assets")
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      filename: metadata.filename,
      storage_key: metadata.storageKey,
      mime_type: metadata.mimeType,
      size_bytes: metadata.sizeBytes,
      duration_seconds: metadata.durationSeconds ?? null,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as AssetRow;
}

export async function listAssets(
  workspaceId: string,
  options: {
    projectId?: string;
    mimeTypeFilter?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ assets: AssetRow[]; count: number | null }> {
  const supabase = await createClient();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = supabase
    .from("assets")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.projectId) query = query.eq("project_id", options.projectId);
  if (options.mimeTypeFilter) query = query.eq("mime_type", options.mimeTypeFilter);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { assets: (data ?? []) as unknown as AssetRow[], count };
}

export async function getAsset(
  assetId: string,
  workspaceId: string,
): Promise<AssetRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as unknown as AssetRow | null) ?? null;
}

export async function getUploadUrl(
  workspaceId: string,
  projectId: string,
  filename: string,
  _mimeType: string,
): Promise<{ storageKey: string; uploadUrl: string }> {
  void _mimeType;
  const safe = sanitizeFilename(filename);
  const storageKey = `${workspaceId}/${projectId}/${crypto.randomUUID()}-${safe}`;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(ASSETS_BUCKET)
    .createSignedUploadUrl(storageKey);

  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Failed to create signed upload URL");

  return { storageKey, uploadUrl: data.signedUrl };
}

export async function getSignedDownloadUrl(storageKey: string): Promise<string> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(storageKey, 60 * 60);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Failed to create signed download URL");
  return data.signedUrl;
}

export async function deleteAsset(assetId: string, workspaceId: string): Promise<boolean> {
  const existing = await getAsset(assetId, workspaceId);
  if (!existing) return false;

  const admin = createServiceRoleClient();
  const { error: storageError } = await admin.storage
    .from(ASSETS_BUCKET)
    .remove([existing.storage_key]);
  if (storageError) throw new Error(storageError.message);

  const supabase = await createClient();
  const { error: dbError } = await supabase
    .from("assets")
    .delete()
    .eq("id", assetId)
    .eq("workspace_id", workspaceId);
  if (dbError) throw new Error(dbError.message);

  return true;
}
