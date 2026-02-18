import { notFound } from "next/navigation";

import { EditorWorkspace } from "@/components/editor/editor-workspace";
import { createClient } from "@/lib/supabase/server";
import { getFormatPresetById, isFormatPresetId } from "@/lib/presets";
import type { ProjectJSON } from "@/lib/twick";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v,
  );
}

function defaultProjectJson(
  projectId: string,
  title: string,
  formatPresetId?: string | null,
): ProjectJSON {
  const preset =
    formatPresetId && isFormatPresetId(formatPresetId)
      ? getFormatPresetById(formatPresetId)
      : undefined;

  const width = preset?.width ?? 1920;
  const height = preset?.height ?? 1080;
  const fps = preset?.fps ?? 30;

  return {
    schemaVersion: 1,
    id: projectId,
    title,
    format: {
      preset: preset?.id ?? "landscape_16_9",
      width,
      height,
      fps,
    },
    elements: [
      {
        id: "el-1",
        type: "text",
        startMs: 0,
        durationMs: 5000,
        text: "Click canvas to select",
        x: 96,
        y: 96,
        fontSize: 32,
        color: "#ffffff",
      },
    ],
    timeline: {
      currentTimeMs: 0,
      playing: false,
    },
  };
}

function coerceProjectJson(v: unknown, fallback: ProjectJSON): ProjectJSON {
  if (!v || typeof v !== "object") return fallback;
  const obj = v as Partial<ProjectJSON> & Record<string, unknown>;

  const fmt = (obj.format ?? {}) as Partial<ProjectJSON["format"]> &
    Record<string, unknown>;
  const tl = (obj.timeline ?? {}) as Partial<ProjectJSON["timeline"]> &
    Record<string, unknown>;

  return {
    schemaVersion: 1,
    id: typeof obj.id === "string" ? obj.id : fallback.id,
    title: typeof obj.title === "string" ? obj.title : fallback.title,
    format: {
      preset: typeof fmt.preset === "string" ? fmt.preset : fallback.format.preset,
      width: typeof fmt.width === "number" ? fmt.width : fallback.format.width,
      height: typeof fmt.height === "number" ? fmt.height : fallback.format.height,
      fps: typeof fmt.fps === "number" ? fmt.fps : fallback.format.fps,
    },
    elements: Array.isArray(obj.elements)
      ? (obj.elements as ProjectJSON["elements"])
      : fallback.elements,
    timeline: {
      currentTimeMs:
        typeof tl.currentTimeMs === "number"
          ? tl.currentTimeMs
          : fallback.timeline.currentTimeMs,
      playing:
        typeof tl.playing === "boolean" ? tl.playing : fallback.timeline.playing,
    },
  };
}

async function loadProject(projectId: string) {
  // Non-uuid IDs (like /editor/test-id) should still render in local/dev mode.
  if (!isUuid(projectId)) {
    return {
      projectJson: defaultProjectJson(projectId, "Untitled Project"),
    } as const;
  }

  try {
    const supabase = await createClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id,title,format_preset,current_version_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) return null;

    const fallback = defaultProjectJson(
      projectId,
      project.title,
      project.format_preset,
    );

    if (!project.current_version_id) {
      return {
        projectJson: fallback,
      } as const;
    }

    const { data: version } = await supabase
      .from("project_versions")
      .select("project_json")
      .eq("id", project.current_version_id)
      .maybeSingle();

    const projectJson = coerceProjectJson(version?.project_json, fallback);

    return {
      projectJson,
    } as const;
  } catch {
    // Missing env vars / Supabase not configured.
    return {
      projectJson: defaultProjectJson(projectId, "Untitled Project"),
    } as const;
  }
}

export default async function EditorProjectPage({
  params,
}: Readonly<{ params: { projectId: string } }>) {
  const loaded = await loadProject(params.projectId);
  if (!loaded) notFound();

  return (
    <EditorWorkspace
      projectId={params.projectId}
      initialProjectJson={loaded.projectJson}
    />
  );
}

