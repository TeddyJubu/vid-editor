"use client";

import * as React from "react";

import type { CaptionResult, CaptionStyle } from "@/lib/types/caption";

type ApiSuccess<T> = { data: T };
type ApiError = { error: string };

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

export type CaptionGenerationState =
  | { status: "idle"; jobId: null; result: null; error: null }
  | { status: "generating"; jobId: null; result: null; error: null }
  | { status: "polling"; jobId: string; result: null; error: null }
  | { status: "completed"; jobId: string; result: CaptionResult; error: null }
  | { status: "error"; jobId: string | null; result: null; error: string };

export function useGenerateCaptions(projectId: string): {
  status: CaptionGenerationState["status"];
  jobId: string | null;
  result: CaptionResult | null;
  error: string | null;
  generate: (style: CaptionStyle) => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = React.useState<CaptionGenerationState>({
    status: "idle",
    jobId: null,
    result: null,
    error: null,
  });

  const stableProjectId = projectId.trim();

  const reset = React.useCallback(() => {
    setState({ status: "idle", jobId: null, result: null, error: null });
  }, []);

  const generate = React.useCallback(
    async (style: CaptionStyle) => {
      if (!stableProjectId) return;
      setState({ status: "generating", jobId: null, result: null, error: null });

      const res = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: stableProjectId, style }),
      });
      const body = await readJsonSafe(res);
      if (!res.ok) {
        const message = isApiError(body)
          ? body.error
          : `Failed to generate captions (${res.status})`;
        setState({ status: "error", jobId: null, result: null, error: message });
        return;
      }

      const data = (body as ApiSuccess<{ jobId: string; status: string }> | null)?.data;
      const jobId = data?.jobId ?? "";
      if (!jobId) {
        setState({
          status: "error",
          jobId: null,
          result: null,
          error: "Caption job started but no jobId returned",
        });
        return;
      }

      setState({ status: "polling", jobId, result: null, error: null });
    },
    [stableProjectId],
  );

  const jobId = state.status === "polling" || state.status === "completed" ? state.jobId : null;
  const pollingJobId = state.status === "polling" ? state.jobId : "";
  const status = state.status;

  React.useEffect(() => {
    if (status !== "polling") return;
    if (!pollingJobId) return;

    let cancelled = false;

    async function pollOnce() {
      const res = await fetch(`/api/captions/${encodeURIComponent(pollingJobId)}`, {
        method: "GET",
      });
      const body = await readJsonSafe(res);
      if (cancelled) return;

      if (!res.ok) {
        const message = isApiError(body)
          ? body.error
          : `Failed to poll caption job (${res.status})`;
        setState({ status: "error", jobId: pollingJobId, result: null, error: message });
        return;
      }

      const data = (body as ApiSuccess<{
        id: string;
        status: string;
        result: CaptionResult | null;
        error: string | null;
      }> | null)?.data;

      const jobStatus = (data?.status ?? "") as string;
      if (jobStatus === "completed") {
        const result = data?.result;
        if (!result) {
          setState({
            status: "error",
            jobId: pollingJobId,
            result: null,
            error: "Caption job completed but returned no result",
          });
          return;
        }
        setState({ status: "completed", jobId: pollingJobId, result, error: null });
      } else if (jobStatus === "failed") {
        setState({
          status: "error",
          jobId: pollingJobId,
          result: null,
          error: data?.error ?? "Caption generation failed",
        });
      }
    }

    const t = window.setInterval(() => {
      void pollOnce();
    }, 1000);

    // fire immediately
    void pollOnce();

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [pollingJobId, status]);

  return {
    status: state.status,
    jobId,
    result: state.status === "completed" ? state.result : null,
    error: state.status === "error" ? state.error : null,
    generate,
    reset,
  };
}
