import type { ExportVideoOptions, ProjectJSON } from "@/lib/twick/types";

export type StudioConfig = {
  saveProject: (projectJson: ProjectJSON) => Promise<{ versionId: string } | null>;
  loadProject: (projectId: string) => Promise<ProjectJSON | null>;
  exportVideo: (options: ExportVideoOptions) => Promise<void>;
};

function coerceProjectJson(v: unknown): ProjectJSON | null {
  if (!v || typeof v !== "object") return null;
  const obj = v as Partial<ProjectJSON> & Record<string, unknown>;
  if (obj.schemaVersion !== 1) return null;
  if (typeof obj.id !== "string" || typeof obj.title !== "string") return null;
  if (!obj.format || typeof obj.format !== "object") return null;
  const fmt = obj.format as Record<string, unknown>;
  if (
    typeof fmt.preset !== "string" ||
    typeof fmt.width !== "number" ||
    typeof fmt.height !== "number" ||
    typeof fmt.fps !== "number"
  ) {
    return null;
  }
  if (!Array.isArray(obj.elements)) return null;
  if (!obj.timeline || typeof obj.timeline !== "object") return null;
  const tl = obj.timeline as Record<string, unknown>;
  if (typeof tl.currentTimeMs !== "number" || typeof tl.playing !== "boolean") return null;
  return obj as ProjectJSON;
}

export function createStudioConfig(projectId: string): StudioConfig {
  return {
    async saveProject(projectJson) {
      try {
        const res = await fetch(`/api/projects/${projectId}/versions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectJson }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as {
          data?: { version?: { id?: string } };
        };
        const versionId = json.data?.version?.id;
        return versionId ? { versionId } : null;
      } catch {
        return null;
      }
    },

    async loadProject(id) {
      try {
        const res = await fetch(`/api/projects/${id}`, { method: "GET" });
        if (!res.ok) return null;
        const json = (await res.json()) as {
          data?: { latestVersion?: { project_json?: unknown } | null };
        };
        const projectJson = json.data?.latestVersion?.project_json;
        return coerceProjectJson(projectJson) ?? null;
      } catch {
        return null;
      }
    },

    async exportVideo(_options) {
      // Placeholder hook for render integration.
      void _options;
      return;
    },
  };
}
