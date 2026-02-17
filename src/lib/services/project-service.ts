import type { Json, Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { getFormatPresetById, type FormatPresetId } from "@/lib/presets";
import type { ProjectJSON } from "@/lib/twick/types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectVersionRow = Database["public"]["Tables"]["project_versions"]["Row"];

export type ProjectWithLatestVersion = {
  project: ProjectRow;
  latestVersion: ProjectVersionRow | null;
};

export type ListProjectsOptions = {
  limit?: number;
  offset?: number;
  search?: string;
};

function buildInitialProjectJson(
  projectId: string,
  title: string,
  formatPresetId: FormatPresetId,
): ProjectJSON {
  const preset = getFormatPresetById(formatPresetId);

  // Some presets (e.g. "custom") may not have dimensions. Use a safe default.
  const width = preset?.width ?? 1920;
  const height = preset?.height ?? 1080;
  const fps = preset?.fps ?? 30;

  return {
    schemaVersion: 1,
    id: projectId,
    title,
    format: {
      preset: formatPresetId,
      width,
      height,
      fps,
    },
    elements: [],
    timeline: {
      currentTimeMs: 0,
      playing: false,
    },
  };
}

async function getProjectRow(
  projectId: string,
  workspaceId: string,
): Promise<ProjectRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select()
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ProjectRow | null;
}

async function getProjectVersionRow(versionId: string): Promise<ProjectVersionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_versions")
    .select()
    .eq("id", versionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ProjectVersionRow | null;
}

export async function createProject(
  workspaceId: string,
  title: string,
  formatPresetId: FormatPresetId,
  _userId: string,
): Promise<ProjectWithLatestVersion> {
  void _userId;
  const supabase = await createClient();

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      title,
      format_preset: formatPresetId,
    })
    .select("*")
    .single();

  if (projectError) throw new Error(projectError.message);
  const project = projectData as unknown as ProjectRow;

  const { data: versionData, error: versionError } = await supabase
    .from("project_versions")
    .insert({
      project_id: project.id,
      project_json: buildInitialProjectJson(project.id, title, formatPresetId) as unknown as Json,
      label: "Initial",
    })
    .select("*")
    .single();

  if (versionError) throw new Error(versionError.message);
  const version = versionData as unknown as ProjectVersionRow;

  const { error: updateError } = await supabase
    .from("projects")
    .update({ current_version_id: version.id })
    .eq("id", project.id)
    .eq("workspace_id", workspaceId);

  if (updateError) throw new Error(updateError.message);

  return { project: { ...project, current_version_id: version.id }, latestVersion: version };
}

export async function getProject(
  projectId: string,
  workspaceId: string,
): Promise<ProjectWithLatestVersion | null> {
  const project = await getProjectRow(projectId, workspaceId);
  if (!project) return null;

  const latestVersion = project.current_version_id
    ? await getProjectVersionRow(project.current_version_id)
    : null;

  return { project, latestVersion };
}

export async function listProjects(
  workspaceId: string,
  options: ListProjectsOptions = {},
): Promise<{ projects: ProjectRow[]; count: number | null }> {
  const supabase = await createClient();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = supabase
    .from("projects")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.search && options.search.trim()) {
    query = query.ilike("title", `%${options.search.trim()}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { projects: (data ?? []) as unknown as ProjectRow[], count };
}

export async function updateProject(
  projectId: string,
  workspaceId: string,
  updates: {
    title?: string;
    thumbnailUrl?: string | null;
    formatPresetId?: FormatPresetId;
  },
): Promise<ProjectRow | null> {
  const supabase = await createClient();

  const payload: Database["public"]["Tables"]["projects"]["Update"] = {};
  if (typeof updates.title === "string") payload.title = updates.title;
  if (updates.thumbnailUrl !== undefined) payload.thumbnail_url = updates.thumbnailUrl;
  if (updates.formatPresetId) payload.format_preset = updates.formatPresetId;

  const { data, error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as unknown as ProjectRow | null) ?? null;
}

export async function deleteProject(
  projectId: string,
  workspaceId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean((data as { id?: string } | null)?.id);
}

export async function duplicateProject(
  projectId: string,
  workspaceId: string,
  userId: string,
): Promise<ProjectWithLatestVersion | null> {
  const original = await getProject(projectId, workspaceId);
  if (!original) return null;

  const supabase = await createClient();
  const copyTitle = `${original.project.title} (Copy)`;

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      title: copyTitle,
      format_preset: original.project.format_preset,
      thumbnail_url: original.project.thumbnail_url,
    })
    .select("*")
    .single();

  if (projectError) throw new Error(projectError.message);
  const project = projectData as unknown as ProjectRow;

  const { data: versionData, error: versionError } = await supabase
    .from("project_versions")
    .insert({
      project_id: project.id,
      project_json: (original.latestVersion?.project_json ??
        (buildInitialProjectJson(
          project.id,
          copyTitle,
          original.project.format_preset as FormatPresetId,
        ) as unknown as Json)) as Json,
      label: `Duplicated by ${userId}`,
    })
    .select("*")
    .single();

  if (versionError) throw new Error(versionError.message);
  const version = versionData as unknown as ProjectVersionRow;

  const { error: updateError } = await supabase
    .from("projects")
    .update({ current_version_id: version.id })
    .eq("id", project.id)
    .eq("workspace_id", workspaceId);

  if (updateError) throw new Error(updateError.message);

  return { project: { ...project, current_version_id: version.id }, latestVersion: version };
}

export async function saveProjectVersion(
  projectId: string,
  workspaceId: string,
  projectJson: Record<string, unknown>,
  label?: string,
): Promise<ProjectVersionRow | null> {
  const existing = await getProjectRow(projectId, workspaceId);
  if (!existing) return null;

  const supabase = await createClient();
  const { data: versionData, error: versionError } = await supabase
    .from("project_versions")
    .insert({
      project_id: projectId,
      project_json: projectJson as Json,
      label: label ?? null,
    })
    .select("*")
    .single();

  if (versionError) throw new Error(versionError.message);
  const version = versionData as unknown as ProjectVersionRow;

  const { error: updateError } = await supabase
    .from("projects")
    .update({ current_version_id: version.id })
    .eq("id", projectId)
    .eq("workspace_id", workspaceId);

  if (updateError) throw new Error(updateError.message);
  return version;
}

export async function getProjectVersion(versionId: string): Promise<ProjectVersionRow | null> {
  return getProjectVersionRow(versionId);
}

export async function listProjectVersions(
  projectId: string,
  workspaceId: string,
): Promise<ProjectVersionRow[] | null> {
  const existing = await getProjectRow(projectId, workspaceId);
  if (!existing) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProjectVersionRow[];
}
