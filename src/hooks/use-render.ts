"use client";

import * as React from "react";

import type { RenderTier } from "@/lib/services/render-service";
import type { ProjectJSON } from "@/lib/twick";
import { createStudioConfig } from "@/lib/twick";
import { renderDraft, type RenderProgress } from "@/lib/render/browser-render";

type ApiSuccess<T> = { data: T };
type ApiError = { error: string };

function isApiError(v: unknown): v is ApiError {
  return typeof v === "object" && v !== null && "error" in v;
}

async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export type RenderState =
  | { status: "idle" }
  | { status: "rendering"; progress: RenderProgress; jobId: string | null }
  | { status: "complete"; url: string; mimeType: string; jobId: string | null }
  | { status: "error"; error: string; jobId: string | null };

function extractDurationSeconds(projectJson: unknown): number {
  if (!projectJson || typeof projectJson !== "object") return 10;
  const obj = projectJson as Record<string, unknown>;
  const elements = obj.elements;
  if (!Array.isArray(elements) || elements.length === 0) return 10;
  let maxEndMs = 0;
  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const rec = el as Record<string, unknown>;
    const startMs = typeof rec.startMs === "number" ? rec.startMs : 0;
    const durationMs = typeof rec.durationMs === "number" ? rec.durationMs : 0;
    const endMs = startMs + durationMs;
    if (Number.isFinite(endMs) && endMs > maxEndMs) maxEndMs = endMs;
  }
  const seconds = maxEndMs / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 10;
}

export function useRender(projectId: string): {
  state: RenderState;
  startDraft: (projectJson: ProjectJSON, tier: RenderTier) => Promise<void>;
  cancel: () => void;
  clear: () => void;
} {
  const [state, setState] = React.useState<RenderState>({ status: "idle" });
  const controllerRef = React.useRef<AbortController | null>(null);
  const urlRef = React.useRef<string | null>(null);

  const cancel = React.useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const clear = React.useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setState({ status: "idle" });
  }, []);

  React.useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const startDraft = React.useCallback(
    async (projectJson: ProjectJSON, tier: RenderTier) => {
      clear();
      const controller = new AbortController();
      controllerRef.current = controller;

      const durationSeconds = extractDurationSeconds(projectJson);
      const totalFrames = Math.max(1, Math.ceil(durationSeconds * projectJson.format.fps));
      setState({
        status: "rendering",
        progress: {
          currentFrame: 0,
          totalFrames,
          percent: 0,
          elapsedMs: 0,
          estimatedRemainingMs: null,
        },
        jobId: null,
      });

      let jobId: string | null = null;
      try {
        const studio = createStudioConfig(projectId);
        const saved = await studio.saveProject(projectJson);
        if (!saved?.versionId) {
          throw new Error("Failed to save project version before render");
        }

        const createRes = await fetch("/api/render-jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectVersionId: saved.versionId,
            tier,
            projectJson,
          }),
        });
        const createBody = await readJsonSafe(createRes);
        if (!createRes.ok) {
          const msg = isApiError(createBody)
            ? createBody.error
            : `Failed to create render job (${createRes.status})`;
          throw new Error(msg);
        }

        jobId = (createBody as ApiSuccess<{ job: { id: string } }> | null)?.data?.job?.id ?? null;
        if (!jobId) throw new Error("Render job created but no job id returned");

        const startedAt = new Date().toISOString();
        await fetch(`/api/render-jobs/${encodeURIComponent(jobId)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "rendering",
            fromStatus: "pending",
            startedAt,
          }),
        });

        const result = await renderDraft(
          projectJson,
          { tier, signal: controller.signal },
          (p) => setState({ status: "rendering", progress: p, jobId }),
        );

        urlRef.current = result.url;
        setState({ status: "complete", url: result.url, mimeType: result.mimeType, jobId });

        const completedAt = new Date().toISOString();
        await fetch(`/api/render-jobs/${encodeURIComponent(jobId)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            fromStatus: "rendering",
            completedAt,
          }),
        });
      } catch (err) {
        const aborted =
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError");
        const message = aborted
          ? "Cancelled"
          : err instanceof Error
            ? err.message
            : "Render failed";

        setState(aborted ? { status: "idle" } : { status: "error", error: message, jobId });
        if (jobId) {
          const completedAt = new Date().toISOString();
          await fetch(`/api/render-jobs/${encodeURIComponent(jobId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status: "failed",
              fromStatus: "rendering",
              errorMessage: message,
              completedAt,
            }),
          });
        }
      }
    },
    [clear, projectId],
  );

  return { state, startDraft, cancel, clear };
}
