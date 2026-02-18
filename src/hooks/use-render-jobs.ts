"use client";

import * as React from "react";

import type { RenderJob, RenderJobStatus, RenderOutput } from "@/lib/types/render";

type ApiSuccess<T> = { data: T };
type ApiError = { error: string };

export type RenderJobWithOutputs = RenderJob & { outputs?: RenderOutput[] };

type ListRenderJobsData = { jobs: RenderJobWithOutputs[]; count: number | null };
type GetRenderJobData = { job: RenderJob; outputs: RenderOutput[] };

function isApiError(v: unknown): v is ApiError {
  return Boolean(v) && typeof v === "object" && "error" in (v as Record<string, unknown>);
}

async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export type UseRenderJobsResult = {
  jobs: RenderJobWithOutputs[];
  count: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useRenderJobs(options?: {
  status?: RenderJobStatus;
  active?: boolean;
  projectId?: string;
  includeOutputs?: boolean;
  limit?: number;
  offset?: number;
}): UseRenderJobsResult {
  const status = options?.status;
  const active = options?.active;
  const projectId = options?.projectId;
  const includeOutputs = options?.includeOutputs;
  const limit = options?.limit;
  const offset = options?.offset;

  const [jobs, setJobs] = React.useState<RenderJobWithOutputs[]>([]);
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (typeof limit === "number") params.set("limit", String(limit));
    if (typeof offset === "number") params.set("offset", String(offset));
    if (status) params.set("status", status);
    if (active) params.set("active", "1");
    if (projectId) params.set("projectId", projectId);
    if (includeOutputs) params.set("includeOutputs", "1");

    const url = params.toString() ? `/api/render-jobs?${params.toString()}` : "/api/render-jobs";
    const res = await fetch(url, { method: "GET" });
    const body = await readJsonSafe(res);

    if (!res.ok) {
      const message = isApiError(body) ? body.error : `Failed to load render jobs (${res.status})`;
      setError(message);
      setJobs([]);
      setCount(0);
      setLoading(false);
      return;
    }

    const data = (body as ApiSuccess<ListRenderJobsData> | null)?.data;
    setJobs(data?.jobs ?? []);
    setCount(typeof data?.count === "number" ? data.count : (data?.jobs ?? []).length);
    setLoading(false);
  }, [active, includeOutputs, limit, offset, projectId, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  return { jobs, count, loading, error, refresh };
}

export type UseRenderJobResult = {
  job: RenderJob | null;
  outputs: RenderOutput[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useRenderJob(jobId?: string | null): UseRenderJobResult {
  const stableJobId = jobId?.trim() ? jobId.trim() : "";

  const [job, setJob] = React.useState<RenderJob | null>(null);
  const [outputs, setOutputs] = React.useState<RenderOutput[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!stableJobId) {
      setJob(null);
      setOutputs([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/render-jobs/${encodeURIComponent(stableJobId)}`, {
      method: "GET",
    });
    const body = await readJsonSafe(res);

    if (!res.ok) {
      const message = isApiError(body) ? body.error : `Failed to load render job (${res.status})`;
      setError(message);
      setJob(null);
      setOutputs([]);
      setLoading(false);
      return;
    }

    const data = (body as ApiSuccess<GetRenderJobData> | null)?.data;
    setJob(data?.job ?? null);
    setOutputs(data?.outputs ?? []);
    setLoading(false);
  }, [stableJobId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Poll while pending/rendering.
  React.useEffect(() => {
    if (!stableJobId) return;
    const status = (job?.status ?? "") as RenderJobStatus | "";
    if (status !== "pending" && status !== "rendering") return;

    const t = window.setInterval(() => {
      void load();
    }, 2000);

    return () => window.clearInterval(t);
  }, [job?.status, load, stableJobId]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  return { job, outputs, loading, error, refresh };
}
