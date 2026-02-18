"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadZone } from "@/components/upload-zone";
import { DotsIcon, ImageIcon, MusicIcon, PlayIcon } from "@/components/icons";
import { useAssets, type Asset } from "@/hooks/use-assets";
import { useProjects } from "@/hooks/use-projects";
import { formatFileSize } from "@/lib/format-file-size";
import { formatRelativeTime } from "@/lib/format-time";

type AssetTypeFilter = "all" | "video" | "image" | "audio";

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

function assetType(asset: Asset): Exclude<AssetTypeFilter, "all"> {
  if (asset.mime_type.startsWith("video/")) return "video";
  if (asset.mime_type.startsWith("audio/")) return "audio";
  return "image";
}

function AssetIcon({ type }: Readonly<{ type: Exclude<AssetTypeFilter, "all"> }>) {
  if (type === "audio") return <MusicIcon className="h-4 w-4" />;
  if (type === "image") return <ImageIcon className="h-4 w-4" />;
  return <PlayIcon className="h-4 w-4" />;
}

async function getSignedUrl(assetId: string): Promise<string> {
  const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, { method: "GET" });
  const body = await readJsonSafe(res);
  if (!res.ok) {
    const message = isApiError(body) ? body.error : `Failed to get download URL (${res.status})`;
    throw new Error(message);
  }
  const signedUrl = (body as ApiSuccess<{ signedUrl: string }> | null)?.data?.signedUrl;
  if (!signedUrl) throw new Error("Server did not return signedUrl");
  return signedUrl;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="h-24 w-full animate-pulse bg-muted/50" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted/50" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted/40" />
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const { projects, loading: projectsLoading, error: projectsError } = useProjects();
  const { assets, count, loading, error, uploadAsset, deleteAsset } = useAssets();

  const [uploadProjectId, setUploadProjectId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<AssetTypeFilter>("all");
  const [query, setQuery] = React.useState("");
  const [busyAssetId, setBusyAssetId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (uploadProjectId) return;
    if (projects.length === 0) return;
    setUploadProjectId(projects[0]?.id ?? null);
  }, [projects, uploadProjectId]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      const t = assetType(a);
      if (filter !== "all" && t !== filter) return false;
      if (!q) return true;
      return (a.filename ?? "").toLowerCase().includes(q);
    });
  }, [assets, filter, query]);

  const downloadAsset = React.useCallback(async (asset: Asset) => {
    setActionError(null);
    setBusyAssetId(asset.id);
    try {
      const signedUrl = await getSignedUrl(asset.id);
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = asset.filename;
      a.rel = "noreferrer";
      a.target = "_blank";
      a.click();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to download asset");
    } finally {
      setBusyAssetId(null);
    }
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Assets</h1>
          <Badge variant="secondary">{loading ? "—" : count}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "secondary" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "video" ? "secondary" : "outline"}
            onClick={() => setFilter("video")}
          >
            Video
          </Button>
          <Button
            size="sm"
            variant={filter === "image" ? "secondary" : "outline"}
            onClick={() => setFilter("image")}
          >
            Images
          </Button>
          <Button
            size="sm"
            variant={filter === "audio" ? "secondary" : "outline"}
            onClick={() => setFilter("audio")}
          >
            Audio
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assets"
          aria-label="Search assets"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Upload to</label>
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            value={uploadProjectId ?? ""}
            onChange={(e) => setUploadProjectId(e.target.value || null)}
            aria-label="Upload target project"
          >
            {projectsLoading ? <option value="">Loading projects…</option> : null}
            {!projectsLoading && projects.length === 0 ? (
              <option value="">No projects</option>
            ) : null}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {projectsError ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <div className="font-medium">Couldn&apos;t load projects</div>
          <div className="mt-1 text-muted-foreground">{projectsError}</div>
        </div>
      ) : null}

      {!uploadProjectId ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Select a project to upload new assets. You can still browse existing assets below.
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Upload</div>
            <div className="text-xs text-muted-foreground">Drag & drop or pick multiple files.</div>
          </div>
        </div>
        <UploadZone projectId={uploadProjectId} uploadAsset={uploadAsset} />
      </div>

      {error ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <div className="font-medium">Couldn&apos;t load assets</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
      ) : actionError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-900 dark:text-red-200">
          {actionError}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 p-6">
          <div className="text-base font-semibold">No assets found</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {query.trim() ? "Try a different search." : "Upload an asset to get started."}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const t = assetType(a);
            return (
              <div key={a.id} className="group relative rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <AssetIcon type={t} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.filename}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(a.size_bytes)}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(a.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className="rounded-md border border-border bg-background p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                        aria-label="Asset actions"
                        disabled={busyAssetId === a.id}
                      >
                        <DotsIcon className="h-4 w-4" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content
                      align="end"
                      className="z-50 min-w-44 rounded-md border border-border bg-popover p-1 text-sm shadow-lg"
                      sideOffset={6}
                    >
                      <DropdownMenu.Item
                        className="cursor-pointer rounded px-2 py-1.5 text-foreground outline-none hover:bg-muted"
                        onSelect={() => void downloadAsset(a)}
                      >
                        Download
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Item
                        className="cursor-pointer rounded px-2 py-1.5 text-red-600 outline-none hover:bg-red-500/10"
                        onSelect={async () => {
                          if (!confirm(`Delete ${a.filename}?`)) return;
                          setActionError(null);
                          setBusyAssetId(a.id);
                          try {
                            await deleteAsset(a.id);
                          } catch (err) {
                            setActionError(err instanceof Error ? err.message : "Failed to delete asset");
                          } finally {
                            setBusyAssetId(null);
                          }
                        }}
                      >
                        Delete
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
