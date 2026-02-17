"use client";

import * as React from "react";

import type { RenderJob, RenderOutput } from "@/lib/types/render";

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

type AuthedOutputData = {
  output: RenderOutput;
  job: RenderJob;
  signedUrl: string;
  shareUrl: string;
};

export function useRenderOutput(outputId?: string | null): {
  output: RenderOutput | null;
  job: RenderJob | null;
  signedUrl: string | null;
  shareUrl: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const stableId = outputId?.trim() ? outputId.trim() : "";

  const [output, setOutput] = React.useState<RenderOutput | null>(null);
  const [job, setJob] = React.useState<RenderJob | null>(null);
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!stableId) {
      setOutput(null);
      setJob(null);
      setSignedUrl(null);
      setShareUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/render-outputs/${encodeURIComponent(stableId)}`, {
      method: "GET",
    });
    const body = await readJsonSafe(res);

    if (!res.ok) {
      const message = isApiError(body)
        ? body.error
        : `Failed to load render output (${res.status})`;
      setError(message);
      setOutput(null);
      setJob(null);
      setSignedUrl(null);
      setShareUrl(null);
      setLoading(false);
      return;
    }

    const data = (body as ApiSuccess<AuthedOutputData> | null)?.data;
    setOutput(data?.output ?? null);
    setJob(data?.job ?? null);
    setSignedUrl(data?.signedUrl ?? null);
    setShareUrl(data?.shareUrl ?? null);
    setLoading(false);
  }, [stableId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  return { output, job, signedUrl, shareUrl, loading, error, refresh };
}

type PublicOutputData = { output: RenderOutput; signedUrl: string };

export function useRenderOutputByShare(shareToken?: string | null): {
  output: RenderOutput | null;
  signedUrl: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const stableToken = shareToken?.trim() ? shareToken.trim() : "";

  const [output, setOutput] = React.useState<RenderOutput | null>(null);
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!stableToken) {
      setOutput(null);
      setSignedUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/render-outputs/share/${encodeURIComponent(stableToken)}`, {
      method: "GET",
    });
    const body = await readJsonSafe(res);

    if (!res.ok) {
      const message = isApiError(body) ? body.error : `Not found (${res.status})`;
      setError(message);
      setOutput(null);
      setSignedUrl(null);
      setLoading(false);
      return;
    }

    const data = (body as ApiSuccess<PublicOutputData> | null)?.data;
    setOutput(data?.output ?? null);
    setSignedUrl(data?.signedUrl ?? null);
    setLoading(false);
  }, [stableToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  return { output, signedUrl, loading, error, refresh };
}

