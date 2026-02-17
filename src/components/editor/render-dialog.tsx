"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";

import type { ProjectJSON } from "@/lib/twick";
import { estimateRenderUnits } from "@/lib/render/browser-render";
import { copyToClipboard } from "@/lib/clipboard";
import { formatFileSize } from "@/lib/format-file-size";
import { formatRelativeTime } from "@/lib/format-time";
import type { RenderJobStatus, RenderOutput } from "@/lib/types/render";
import { useWebCodecsSupport } from "@/hooks/use-webcodecs-support";
import { useCredits } from "@/hooks/use-credits";
import { useRenderJobs } from "@/hooks/use-render-jobs";
import { useRender } from "@/hooks/use-render";

import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { OVERAGE_RATE_PER_RU } from "@/lib/plans";

function statusLabel(status: RenderJobStatus): string {
	if (status === "pending") return "Pending";
	if (status === "rendering") return "Rendering";
	if (status === "completed") return "Completed";
	return "Failed";
}

function statusBadgeClass(status: RenderJobStatus): string {
	if (status === "pending") {
		return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
	}
	if (status === "rendering") {
		return "border-blue-500/30 bg-blue-500/10 text-blue-200";
	}
	if (status === "completed") {
		return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
	}
	return "border-rose-500/30 bg-rose-500/10 text-rose-200";
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

function pickPrimaryOutput(outputs?: RenderOutput[] | null): RenderOutput | null {
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

function formatMs(ms: number | null) {
  if (ms === null) return "—";
  if (!Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RenderDialog({
  open,
  onOpenChange,
  projectId,
  projectJson,
}: Readonly<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projectJson: ProjectJSON;
}>) {
	const { toast } = useToast();
  const { supported, checking } = useWebCodecsSupport();
  const { balance, loading: creditsLoading } = useCredits();
  const { state, startDraft, cancel, clear } = useRender(projectId);
	const {
		jobs: history,
		loading: historyLoading,
		error: historyError,
		refresh: refreshHistory,
	} = useRenderJobs({ projectId, includeOutputs: true, limit: 50 });

  React.useEffect(() => {
    if (!open) {
      clear();
    }
  }, [open, clear]);

	React.useEffect(() => {
		if (!open) return;
		const hasActive = history.some((j) => j.status === "pending" || j.status === "rendering");
		if (!hasActive) return;

		const t = window.setInterval(() => {
			void refreshHistory();
		}, 2000);

		return () => window.clearInterval(t);
	}, [history, open, refreshHistory]);

  const ru = React.useMemo(() => estimateRenderUnits(projectJson, "draft"), [projectJson]);
  const canStart = supported && !checking && state.status !== "rendering";
	const insufficientCredits = !creditsLoading && balance < ru;

  const filenameBase = (projectJson.title || "draft").trim().slice(0, 80) || "draft";
  const downloadName = `${filenameBase}-draft.webm`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-white/10 bg-[#0f1115] p-5 shadow-xl text-white",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold">Draft Render</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-white/60">
                Browser-only stub renderer (Canvas → WebCodecs → WebM)
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Close
              </Button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-white/70">Tier</div>
                  <div className="mt-1 text-sm">Draft (browser)</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-white/70">Estimated RU</div>
                  <div className="mt-1 text-sm">{ru}</div>
                </div>
              </div>
				  <div className="mt-3 flex items-center justify-between text-xs text-white/60">
				    <span>Your balance</span>
				    <span className="text-white/80">
				      {creditsLoading ? "—" : `${balance} RU`}
				    </span>
				  </div>
	              {/* Keep a disabled selector placeholder so it's easy to extend later */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70"
                  aria-disabled
                  disabled
                >
                  Draft
                </button>
                <span className="text-xs text-white/40">(standard/pro/ultra are server-side)</span>
              </div>
            </div>

				{insufficientCredits ? (
				  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
				    You have <span className="font-semibold">{balance} RU</span> remaining, but this render is
				    estimated at <span className="font-semibold">{ru} RU</span>. You can still render — we&apos;ll record
				    overage at <span className="font-semibold">${OVERAGE_RATE_PER_RU.toFixed(2)}/RU</span>.{" "}
				    <Link href="/settings" className="underline underline-offset-2">
				      Upgrade
				    </Link>
				    .
				  </div>
				) : null}

            {!supported && !checking ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
	                WebCodecs isn&apos;t available in this browser/context. Use Chrome/Edge on https/localhost.
              </div>
            ) : null}

            {state.status === "rendering" ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-white/70">
                  <span>
                    Frame {state.progress.currentFrame}/{state.progress.totalFrames}
                  </span>
                  <span>
                    {state.progress.percent.toFixed(0)}% • ETA {formatMs(state.progress.estimatedRemainingMs)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-black/30">
                  <div
                    className="h-full bg-brand"
                    style={{ width: `${state.progress.percent}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={cancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {state.status === "complete" ? (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
                <div className="text-sm font-medium text-emerald-100">Render complete</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <a
                    href={state.url}
                    download={downloadName}
                    className="text-sm underline underline-offset-2"
                  >
                    Download {downloadName}
                  </a>
                  <Button variant="outline" size="sm" onClick={clear}>
                    Clear
                  </Button>
                </div>
              </div>
            ) : null}

            {state.status === "error" ? (
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-3">
                <div className="text-sm font-medium text-rose-100">Render failed</div>
                <div className="mt-1 text-sm text-rose-100/80">{state.error}</div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={clear}>
                    Reset
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void startDraft(projectJson, "draft")}
                disabled={!canStart}
              >
                Start draft render
              </Button>
            </div>

				<div className="mt-6 border-t border-white/10 pt-4">
					<div className="mb-2 flex items-center justify-between gap-2">
						<div>
							<div className="text-sm font-semibold">Render history</div>
							<div className="mt-0.5 text-xs text-white/60">Newest first</div>
						</div>
						<Button size="sm" variant="outline" onClick={() => void refreshHistory()}>
							Refresh
						</Button>
					</div>

					{historyError ? (
						<div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-100">
							Couldn&apos;t load render history: {historyError}
						</div>
					) : null}

					{historyLoading ? (
						<div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/70">
							Loading...
						</div>
					) : history.length === 0 ? (
						<div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/70">
							No renders yet.
						</div>
					) : (
						<div className="overflow-x-auto rounded-lg border border-white/10">
							<table className="min-w-full text-left text-xs">
								<thead className="border-b border-white/10 bg-black/20 text-white/60">
									<tr>
										<th className="px-3 py-2 font-medium">Date</th>
										<th className="px-3 py-2 font-medium">Tier</th>
										<th className="px-3 py-2 font-medium">Status</th>
										<th className="px-3 py-2 font-medium">Duration</th>
										<th className="px-3 py-2 font-medium">File size</th>
										<th className="px-3 py-2 text-right font-medium">Actions</th>
									</tr>
								</thead>
								<tbody>
									{history.map((job) => {
										const status = job.status as RenderJobStatus;
										const outputs = (job as { outputs?: RenderOutput[] }).outputs;
										const primary = pickPrimaryOutput(outputs);
										const outputId = primary?.id ?? "";
										const shareToken = (primary as { share_token?: string | null } | null)?.share_token ?? "";
										const sizeLabel =
											typeof primary?.size_bytes === "number" ? formatFileSize(primary.size_bytes) : "—";
										const dateLabel = job.created_at
											? new Date(job.created_at).toLocaleString()
											: "—";

										const tierLabel = job.tier === "draft" ? "Draft" : "Final";
										const canDownload = job.status === "completed" && Boolean(outputId);
										const canShare = job.status === "completed" && Boolean(shareToken);

										return (
											<tr key={job.id} className="border-b border-white/10 last:border-0">
												<td className="whitespace-nowrap px-3 py-2">
													<div className="text-white/90">{dateLabel}</div>
													{job.created_at ? (
														<div className="mt-0.5 text-[11px] text-white/50">
															{formatRelativeTime(job.created_at)}
														</div>
													) : null}
												</td>
												<td className="whitespace-nowrap px-3 py-2 text-white/80">{tierLabel}</td>
												<td className="whitespace-nowrap px-3 py-2">
													<Badge variant="outline" className={statusBadgeClass(status)}>
														{statusLabel(status)}
													</Badge>
												</td>
												<td className="whitespace-nowrap px-3 py-2 text-white/80">
													{formatDuration(job.duration_seconds)}
												</td>
												<td className="whitespace-nowrap px-3 py-2 text-white/80">{sizeLabel}</td>
												<td className="whitespace-nowrap px-3 py-2 text-right">
													<div className="flex items-center justify-end gap-2">
														<Button
															size="sm"
															variant="outline"
															disabled={!canDownload}
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
															disabled={!canShare}
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
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
