"use client";

import * as React from "react";

import type { Asset } from "@/lib/types/asset";
import { useToast } from "@/components/toast-provider";

export type { Asset } from "@/lib/types/asset";

type ApiSuccess<T> = { data: T };
type ApiError = { error: string };

type ListAssetsData = { assets: Asset[]; count: number | null };
type CreateAssetData = { asset: Asset; storageKey: string; uploadUrl: string };

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

export type UseAssetsResult = {
  assets: Asset[];
  count: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  uploadAsset: (
    file: File,
    projectId: string,
    options?: { onProgress?: (pct: number) => void; signal?: AbortSignal },
  ) => Promise<Asset>;
  deleteAsset: (assetId: string) => Promise<void>;
};

function isAbortError(err: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

async function putWithProgress(
  uploadUrl: string,
  file: File,
  options?: { onProgress?: (pct: number) => void; signal?: AbortSignal },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    if (file.type) {
      try {
        xhr.setRequestHeader("Content-Type", file.type);
      } catch {
        // Ignore header set failures for signed URLs.
      }
    }

    const onProgress = options?.onProgress;
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable || e.total <= 0) return;
        const pct = Math.max(0, Math.min(100, Math.round((e.loaded / e.total) * 100)));
        onProgress(pct);
      };
    }

    const signal = options?.signal;
    let abortListener: (() => void) | null = null;
    const cleanup = () => {
      if (signal && abortListener) {
        signal.removeEventListener("abort", abortListener);
      }
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Failed to upload file (${xhr.status})`));
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("Network error during upload"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      abortListener = () => xhr.abort();
      signal.addEventListener("abort", abortListener, { once: true });
    }

    try {
      xhr.send(file);
    } catch (err) {
      cleanup();
      reject(err instanceof Error ? err : new Error("Upload failed"));
    }
  });
}

export function useAssets(projectId?: string): UseAssetsResult {
  const { toast } = useToast();
  const stableProjectId = projectId?.trim() ? projectId.trim() : "";

  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const url = stableProjectId
      ? `/api/assets?projectId=${encodeURIComponent(stableProjectId)}`
      : "/api/assets";

    const res = await fetch(url, { method: "GET" });
    const body = await readJsonSafe(res);
    if (!res.ok) {
      const message = isApiError(body)
        ? body.error
        : `Failed to load assets (${res.status})`;
      setError(message);
      setAssets([]);
      setCount(0);
      setLoading(false);
      return;
    }

    const data = (body as ApiSuccess<ListAssetsData> | null)?.data;
    setAssets(data?.assets ?? []);
    setCount(typeof data?.count === "number" ? data.count : (data?.assets ?? []).length);
    setLoading(false);
  }, [stableProjectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  const uploadAsset = React.useCallback(
    async (
      file: File,
      targetProjectId: string,
      options?: { onProgress?: (pct: number) => void; signal?: AbortSignal },
    ) => {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          projectId: targetProjectId,
        }),
        signal: options?.signal,
      });
      const body = await readJsonSafe(res);

      if (!res.ok) {
        const message = isApiError(body)
          ? body.error
          : `Failed to start upload (${res.status})`;
        toast({ title: "Upload failed", description: message, variant: "destructive" });
        throw new Error(message);
      }

      const data = (body as ApiSuccess<CreateAssetData> | null)?.data;
      const asset = data?.asset;
      const uploadUrl = data?.uploadUrl;

      if (!asset || !uploadUrl) {
        const message = "Server did not return upload URL";
        toast({ title: "Upload failed", description: message, variant: "destructive" });
        throw new Error(message);
      }

      try {
        await putWithProgress(uploadUrl, file, options);
      } catch (err) {
        if (isAbortError(err)) {
          // Cancellation should be silent (UI will show cancelled state).
          throw err instanceof Error ? err : new Error("Upload cancelled");
        }
        const message = err instanceof Error ? err.message : "Upload failed";
        toast({ title: "Upload failed", description: message, variant: "destructive" });
        throw new Error(message);
      }

      setAssets((prev) => {
        const exists = prev.some((x) => x.id === asset.id);
        if (!exists) setCount((c) => c + 1);
        return exists ? prev : [asset, ...prev];
      });
      toast({ title: "Asset uploaded", variant: "success" });
      return asset;
    },
    [toast],
  );

  const deleteAsset = React.useCallback(
    async (assetId: string) => {
      const prevAssets = assets;
      const prevCount = count;

      setAssets((a) => a.filter((x) => x.id !== assetId));
      setCount((c) => Math.max(0, c - 1));

      const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, {
        method: "DELETE",
      });
      const body = await readJsonSafe(res);

      if (!res.ok) {
        const message = isApiError(body)
          ? body.error
          : `Failed to delete asset (${res.status})`;
        setAssets(prevAssets);
        setCount(prevCount);
        toast({ title: "Delete failed", description: message, variant: "destructive" });
        return;
      }

      toast({ title: "Asset deleted", variant: "success" });
    },
    [assets, count, toast],
  );

  return { assets, count, loading, error, refresh, uploadAsset, deleteAsset };
}
