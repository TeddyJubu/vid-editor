"use client";

import * as React from "react";

import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { useRenderJob, useRenderJobs } from "@/hooks/use-render-jobs";
import { copyToClipboard } from "@/lib/clipboard";
import { formatRelativeTime } from "@/lib/format-time";
import type { RenderJob, RenderJobStatus, RenderOutput } from "@/lib/types/render";

type StatusFilter = "all" | RenderJobStatus;

function statusLabel(status: RenderJobStatus): string {
  if (status === "pending") return "Pending";
  if (status === "rendering") return "Rendering";
  if (status === "completed") return "Completed";
  return "Failed";
}

function statusBadgeClass(status: RenderJobStatus): string {
  if (status === "pending") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200";
  }
  if (status === "rendering") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-200";
  }
  if (status === "completed") {
    return "border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-200";
  }
  return "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200";
}

function formatDuration(seconds: unknown): string {
  const s = typeof seconds === "number" ? seconds : NaN;
  if (!Number.isFinite(s) || s < 0) return "—";
  const whole = Math.round(s);
  if (whole < 60) return `${whole}s`;
  const m = Math.floor(whole / 60);
  const rem = whole % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

function formatRu(value: unknown): string {
  const n = typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n < 0) return "—";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function pickPrimaryOutput(outputs: RenderOutput[]): RenderOutput | null {
  if (!Array.isArray(outputs) || outputs.length === 0) return null;
  let best: RenderOutput | null = null;
  let bestTs = -Infinity;
  for (const o of outputs) {
    const ts = new Date((o as { created_at?: string | null }).created_at ?? 0).getTime();
    if (!Number.isFinite(ts)) continue;
    if (!best || ts > bestTs) {
      best = o;
      bestTs = ts;
    }
  }
  return best ?? outputs[0] ?? null;
}

function SkeletonTable() {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-muted/20 px-5 py-3">
        <div className="h-4 w-40 animate-pulse rounded bg-muted/50" />
      </div>
      <div className="p-5">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-muted/30" />
          ))}
        </div>
      </div>
    </Card>
  );
}

function RenderRow({ job }: Readonly<{ job: RenderJob }>) {
  const { toast } = useToast();
  const { outputs, loading: outputsLoading, error: outputsError } = useRenderJob(
    job.status === "completed" ? job.id : null,
  );

  const primaryOutput = pickPrimaryOutput(outputs);
  const outputId = primaryOutput?.id ?? "";
  const shareToken = (primaryOutput as { share_token?: string | null } | null)?.share_token ?? "";

  const canDownload = job.status === "completed" && Boolean(outputId);
  const canShare = job.status === "completed" && Boolean(shareToken);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-4 py-3">
        <Badge variant="outline" className={statusBadgeClass(job.status as RenderJobStatus)}>
          {statusLabel(job.status as RenderJobStatus)}
        </Badge>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">{job.tier ?? "—"}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        {typeof job.width === "number" && typeof job.height === "number"
          ? `${job.width}×${job.height}`
          : "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">{formatDuration(job.duration_seconds)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">{formatRu(job.estimated_ru)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {job.created_at ? formatRelativeTime(job.created_at) : ""}
      </td>
      <td className="px-4 py-3">
        {job.status === "failed" && job.error_message ? (
          <div className="line-clamp-2 text-xs text-red-900 dark:text-red-200">{job.error_message}</div>
        ) : null}
        {job.status === "completed" ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={outputsLoading || !canDownload}
              onClick={() => {
                if (!outputId) return;
                const url = `/api/render-outputs/${encodeURIComponent(outputId)}/download`;
                const a = document.createElement("a");
                a.href = url;
                a.target = "_blank";
                a.rel = "noreferrer";
                a.click();
              }}
            >
              Download
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={outputsLoading || !canShare}
              onClick={() => {
                if (!shareToken) return;
                const origin = typeof window !== "undefined" ? window.location.origin : "";
                const url = origin ? `${origin}/share/${shareToken}` : `/share/${shareToken}`;
                void copyToClipboard(url).then((ok) => {
                  toast({
                    title: ok ? "Share link copied" : "Copy failed",
                    variant: ok ? "success" : "destructive",
                  });
                });
              }}
            >
              Share
            </Button>
          </div>
        ) : null}
        {job.status === "completed" && outputsError ? (
          <div className="mt-1 text-xs text-red-900 dark:text-red-200">{outputsError}</div>
        ) : null}
      </td>
    </tr>
  );
}

export default function RendersPage() {
  const [filter, setFilter] = React.useState<StatusFilter>("all");
  const status = filter === "all" ? undefined : filter;
  const { jobs, count, loading, error, refresh } = useRenderJobs({ status });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Renders</h1>
          <Badge variant="secondary">{loading ? "—" : count}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
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
          variant={filter === "pending" ? "secondary" : "outline"}
          onClick={() => setFilter("pending")}
        >
          Pending
        </Button>
        <Button
          size="sm"
          variant={filter === "rendering" ? "secondary" : "outline"}
          onClick={() => setFilter("rendering")}
        >
          Rendering
        </Button>
        <Button
          size="sm"
          variant={filter === "completed" ? "secondary" : "outline"}
          onClick={() => setFilter("completed")}
        >
          Completed
        </Button>
        <Button
          size="sm"
          variant={filter === "failed" ? "secondary" : "outline"}
          onClick={() => setFilter("failed")}
        >
          Failed
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <div className="font-medium">Couldn&apos;t load renders</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
      ) : null}

      {loading ? (
        <SkeletonTable />
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 p-6">
          <div className="text-base font-semibold">No renders yet</div>
          <div className="mt-1 text-sm text-muted-foreground">
            When you export a video, your render jobs will show up here.
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/20 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Dimensions</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Estimated RU</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <RenderRow key={job.id} job={job} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
