"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { EditorCanvas } from "@/components/editor/editor-canvas";
import { EditorProperties } from "@/components/editor/editor-properties";
import { EditorTimeline } from "@/components/editor/editor-timeline";
import { EditorTopBar } from "@/components/editor/editor-top-bar";
import { EditorToolbar, type EditorTool } from "@/components/editor/editor-toolbar";
import { CaptionsDialog } from "@/components/editor/captions-dialog";
import { RenderDialog } from "@/components/editor/render-dialog";

import { AssetBrowser } from "@/components/editor/asset-browser";

import { useEditorState } from "@/hooks/use-editor-state";
import { useGenerateCaptions } from "@/hooks/use-captions";
import { useRenderJob } from "@/hooks/use-render-jobs";
import { useToast } from "@/components/toast-provider";
import { estimateRenderUnits } from "@/lib/render/browser-render";
import { createStudioConfig, TwickStudio, type ProjectJSON } from "@/lib/twick";
import type { CaptionStyle } from "@/lib/types/caption";
import type { CaptionElement } from "@/lib/twick/types";

type ApiSuccess<T> = { data: T };
type ApiError = { error: string };

function nextTrackIndexFromElements(elements: Array<{ trackIndex?: number }>): number {
	let max = -1;
	for (const el of elements) {
		const t = typeof el.trackIndex === "number" ? el.trackIndex : NaN;
		if (Number.isFinite(t) && t > max) max = t;
	}
	return max + 1;
}

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

export function EditorWorkspace({
  projectId,
  initialProjectJson,
}: Readonly<{ projectId: string; initialProjectJson: ProjectJSON }>) {
  const router = useRouter();
	const { toast } = useToast();
  const [tool, setTool] = React.useState<EditorTool>("select");
  const [timelineCollapsed, setTimelineCollapsed] = React.useState(false);
	const [assetsOpen, setAssetsOpen] = React.useState(false);
	const [renderOpen, setRenderOpen] = React.useState(false);
		const [captionsOpen, setCaptionsOpen] = React.useState(false);
		const [captionStyle, setCaptionStyle] = React.useState<CaptionStyle>("sentence");
		const lastRequestedCaptionStyleRef = React.useRef<CaptionStyle>("sentence");
		const captionToastKeyRef = React.useRef<string>("");
		const [finalJobId, setFinalJobId] = React.useState<string | null>(null);
		const { job: finalJob } = useRenderJob(finalJobId);
		const finalToastKeyRef = React.useRef<string>("");

  const {
    projectJson,
    setProjectJson,
    setTitle,
    saveNow,
    saveStatus,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useEditorState({ projectId, initialProjectJson });

		const {
			status: captionStatus,
			jobId: captionJobId,
			result: captionResult,
			error: captionError,
			generate: generateCaptions,
			reset: resetCaptions,
		} = useGenerateCaptions(projectId);

		const openCaptions = React.useCallback(() => {
			resetCaptions();
			setCaptionsOpen(true);
		}, [resetCaptions]);

		React.useEffect(() => {
			if (captionStatus !== "completed" && captionStatus !== "error") return;
			const key = `${captionJobId ?? ""}:${captionStatus}`;
			if (captionToastKeyRef.current === key) return;
			captionToastKeyRef.current = key;

			if (captionStatus === "completed" && captionResult) {
				const segments = captionResult.segments;
				const trackIndex = nextTrackIndexFromElements(projectJson.elements);
				const style =
					lastRequestedCaptionStyleRef.current === "word_by_word" ? "subtitle" : "default";

				const captionElements: CaptionElement[] = segments.map((s) => {
					const startMs = typeof s.startMs === "number" ? s.startMs : 0;
					const endMs = typeof s.endMs === "number" ? s.endMs : startMs;
					const durationMs = Math.max(1, Math.round(endMs - startMs));
					return {
						id: crypto.randomUUID(),
						type: "caption",
						startMs: Math.round(startMs),
						durationMs,
						trackIndex,
						text: s.text,
						style,
					};
				});

				setProjectJson({
					...projectJson,
					elements: [...projectJson.elements, ...captionElements],
				});

				toast({
					title: "Captions generated!",
					description: `${segments.length} segments added to timeline`,
					variant: "success",
				});

				resetCaptions();
				setCaptionsOpen(false);
			} else if (captionStatus === "error") {
				toast({
					title: "Caption generation failed",
					description: captionError ?? "Caption generation failed",
					variant: "destructive",
				});
			}
		}, [
			captionError,
			captionJobId,
			captionResult,
			captionStatus,
			projectJson,
			resetCaptions,
			setProjectJson,
			toast,
		]);

	const startFinalRender = React.useCallback(async () => {
		const ru = estimateRenderUnits(projectJson, "standard");
		const credits = ru;
		const ok = window.confirm(`This will use ~${ru} RU (${credits} credits). Proceed?`);
		if (!ok) return;

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
					tier: "standard",
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

			const jobId =
				(createBody as ApiSuccess<{ job?: { id?: string | null } }> | null)?.data?.job?.id ?? null;
			if (!jobId) throw new Error("Render job created but no job id returned");

			setFinalJobId(jobId);
			finalToastKeyRef.current = `${jobId}:started`;
			toast({ title: "Render started" });
			setRenderOpen(true);

			// Fire-and-forget: start endpoint is blocking.
			void (async () => {
				try {
					const startRes = await fetch(
						`/api/render-jobs/${encodeURIComponent(jobId)}/start`,
						{ method: "POST" },
					);
					if (!startRes.ok) {
						const startBody = await readJsonSafe(startRes);
						const msg = isApiError(startBody)
							? startBody.error
							: `Failed to start render (${startRes.status})`;
						toast({ title: "Render failed", description: msg, variant: "destructive" });
					}
				} catch (err) {
					toast({
						title: "Render failed",
						description: err instanceof Error ? err.message : "Failed to start render",
						variant: "destructive",
					});
				}
			})();
		} catch (err) {
			toast({
				title: "Render failed",
				description: err instanceof Error ? err.message : "Render failed",
				variant: "destructive",
			});
		}
	}, [projectId, projectJson, toast]);

	React.useEffect(() => {
		if (!finalJobId) return;
		const status = (finalJob?.status ?? "") as string;
		if (status !== "completed" && status !== "failed") return;

		const key = `${finalJobId}:${status}`;
		if (finalToastKeyRef.current === key) return;
		finalToastKeyRef.current = key;

		if (status === "completed") {
			toast({ title: "Render complete — Download ready", variant: "success" });
		} else {
			toast({ title: "Render failed", variant: "destructive" });
		}
	}, [finalJob?.status, finalJobId, toast]);

  return (
    <TwickStudio projectJson={projectJson} onProjectJsonChange={setProjectJson}>
			<div className="twick-studio-scope h-dvh w-dvw overflow-hidden bg-[#0f1020] text-white">
				<div className="flex h-full flex-col">
					<EditorTopBar
            title={projectJson.title}
            onTitleChange={setTitle}
            formatPreset={projectJson.format.preset}
            onBack={() => router.push("/dashboard")}
            onSave={() => void saveNow()}
            onUndo={undo}
            onRedo={redo}
							onGenerateCaptions={openCaptions}
						onDraftRender={() => setRenderOpen(true)}
						onFinalRender={() => void startFinalRender()}
            canUndo={canUndo}
            canRedo={canRedo}
            saveStatus={saveStatus}
          />

						<CaptionsDialog
							open={captionsOpen}
							onOpenChange={setCaptionsOpen}
							style={captionStyle}
							onStyleChange={setCaptionStyle}
							status={captionStatus}
							error={captionError}
							onGenerate={() => {
								lastRequestedCaptionStyleRef.current = captionStyle;
								void generateCaptions(captionStyle);
							}}
						/>

					<RenderDialog
						open={renderOpen}
						onOpenChange={setRenderOpen}
						projectId={projectId}
						projectJson={projectJson}
					/>

					<div className="flex min-h-0 flex-1">
						<EditorToolbar
							tool={tool}
							onToolChange={setTool}
							showAssets={assetsOpen}
							onToggleAssets={() => setAssetsOpen((v) => !v)}
						/>

						{assetsOpen ? (
							<AssetBrowser projectId={projectId} onClose={() => setAssetsOpen(false)} />
						) : null}

						<div className="flex min-w-0 flex-1 flex-col">
							<EditorCanvas tool={tool} />
							<EditorTimeline
								collapsed={timelineCollapsed}
								onToggle={() => setTimelineCollapsed((v) => !v)}
							/>
						</div>

						<EditorProperties />
					</div>
				</div>
			</div>
    </TwickStudio>
  );
}
