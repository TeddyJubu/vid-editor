"use client";

import * as React from "react";

import type { Project } from "@/lib/types/project";
import { useToast } from "@/components/toast-provider";

type ApiSuccess<T> = { data: T };
type ApiError = { error: string };

type ListProjectsData = { projects: Project[]; count: number | null };
type ProjectWithLatestVersion = { project: Project; latestVersion: unknown };

function isApiError(v: unknown): v is ApiError {
	return (
		Boolean(v) &&
		typeof v === "object" &&
		"error" in (v as Record<string, unknown>)
	);
}

async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export type UseProjectsResult = {
  projects: Project[];
  count: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
};

export function useProjects(options?: { search?: string }): UseProjectsResult {
  const { toast } = useToast();
  const search = options?.search?.trim() ? options.search.trim() : "";

  const [projects, setProjects] = React.useState<Project[]>([]);
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const url = search
      ? `/api/projects?search=${encodeURIComponent(search)}`
      : "/api/projects";

    const res = await fetch(url, { method: "GET" });
    const body = await readJsonSafe(res);
    if (!res.ok) {
      const message = isApiError(body)
        ? body.error
        : `Failed to load projects (${res.status})`;
      setError(message);
      setProjects([]);
      setCount(0);
      setLoading(false);
      return;
    }

    const data = (body as ApiSuccess<ListProjectsData> | null)?.data;
    setProjects(data?.projects ?? []);
    setCount(typeof data?.count === "number" ? data.count : (data?.projects ?? []).length);
    setLoading(false);
  }, [search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  const deleteProject = React.useCallback(
    async (id: string) => {
      const prevProjects = projects;
      const prevCount = count;

      setProjects((p) => p.filter((x) => x.id !== id));
      setCount((c) => Math.max(0, c - 1));

      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const body = await readJsonSafe(res);

      if (!res.ok) {
        const message = isApiError(body)
          ? body.error
          : `Failed to delete project (${res.status})`;
        setProjects(prevProjects);
        setCount(prevCount);
        toast({ title: "Delete failed", description: message, variant: "destructive" });
        return;
      }

      toast({ title: "Project deleted", variant: "success" });
    },
    [count, projects, toast],
  );

  const duplicateProject = React.useCallback(
    async (id: string) => {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
      });
      const body = await readJsonSafe(res);

      if (!res.ok) {
        const message = isApiError(body)
          ? body.error
          : `Failed to duplicate project (${res.status})`;
        toast({ title: "Duplicate failed", description: message, variant: "destructive" });
        return;
      }

      const created = (body as ApiSuccess<ProjectWithLatestVersion> | null)?.data?.project;
      if (created) {
        setProjects((prev) => [created, ...prev]);
        setCount((c) => c + 1);
      } else {
        await load();
      }

      toast({ title: "Project duplicated", variant: "success" });
    },
    [load, toast],
  );

  return {
    projects,
    count,
    loading,
    error,
    refresh,
    deleteProject,
    duplicateProject,
  };
}
