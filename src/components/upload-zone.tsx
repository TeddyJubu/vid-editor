"use client";

import * as React from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { UploadIcon } from "@/components/icons";

const MAX_BYTES = 500 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
	"video/mp4",
	"video/webm",
	"video/quicktime",
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	"audio/mpeg",
	"audio/wav",
	"audio/ogg",
	"audio/aac",
]);

type UploadItem = {
	id: string;
	file: File;
	progress: number;
	status: "queued" | "uploading" | "success" | "error" | "cancelled";
	controller?: AbortController;
	error?: string;
};

export function UploadZone({
	projectId,
	uploadAsset,
}: Readonly<{
		projectId: string | null;
		uploadAsset: (
			file: File,
			projectId: string,
			options?: { onProgress?: (pct: number) => void; signal?: AbortSignal },
		) => Promise<unknown>;
}>) {
	const inputRef = React.useRef<HTMLInputElement | null>(null);
	const [dragging, setDragging] = React.useState(false);
	const [items, setItems] = React.useState<UploadItem[]>([]);

	const isAbortError = React.useCallback((err: unknown) => {
		return (
			(typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") ||
			(err instanceof Error && err.name === "AbortError")
		);
	}, []);

	const validate = React.useCallback((file: File) => {
		if (file.size > MAX_BYTES) return "File exceeds 500MB";
		if (!ACCEPTED_MIME_TYPES.has(file.type)) {
			return `Unsupported file type (${file.type || "unknown"})`;
		}
		return null;
	}, []);

	const startUpload = React.useCallback(
		async (file: File) => {
			const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
			const validationError = validate(file);
			if (!projectId) {
				setItems((prev) => [
					{ id, file, progress: 0, status: "error", error: "Missing project" },
					...prev,
				]);
				return;
			}
			if (validationError) {
				setItems((prev) => [
					{ id, file, progress: 0, status: "error", error: validationError },
					...prev,
				]);
				return;
			}

			const controller = new AbortController();
			setItems((prev) => [{ id, file, progress: 0, status: "uploading", controller }, ...prev]);
			try {
				await uploadAsset(file, projectId, {
					signal: controller.signal,
					onProgress: (pct) => {
						setItems((prev) =>
							prev.map((x) => (x.id === id ? { ...x, progress: pct } : x)),
						);
					},
				});
				setItems((prev) =>
					prev.map((x) =>
						x.id === id ? { ...x, progress: 100, status: "success", controller: undefined } : x,
					),
				);
			} catch (err) {
				const aborted = controller.signal.aborted || isAbortError(err);
				setItems((prev) =>
					prev.map((x) => {
						if (x.id !== id) return x;
						if (x.status === "cancelled") return x;
						if (aborted) return { ...x, status: "cancelled", controller: undefined };
						const msg = err instanceof Error ? err.message : "Upload failed";
						return { ...x, status: "error", error: msg, controller: undefined };
					}),
				);
			}
		},
		[isAbortError, projectId, uploadAsset, validate],
	);

	const handleFiles = React.useCallback(
		(files: FileList | null) => {
			if (!files || files.length === 0) return;
			Array.from(files).forEach((f) => void startUpload(f));
		},
		[startUpload],
	);

	const uploadingCount = items.filter((x) => x.status === "uploading").length;
	const hasError = items.some((x) => x.status === "error");
	const hasSuccess = items.some((x) => x.status === "success");

	return (
		<div className="space-y-2">
			<div
				onDragEnter={(e) => {
					e.preventDefault();
					setDragging(true);
				}}
				onDragOver={(e) => {
					e.preventDefault();
					setDragging(true);
				}}
				onDragLeave={(e) => {
					e.preventDefault();
					setDragging(false);
				}}
				onDrop={(e) => {
					e.preventDefault();
					setDragging(false);
					handleFiles(e.dataTransfer.files);
				}}
				className={cn(
					"rounded-lg border border-dashed p-3",
					"bg-black/20 text-white/80",
					dragging ? "border-white/40 bg-white/5" : "border-white/15",
					uploadingCount > 0 ? "border-brand/50" : "",
					hasError ? "border-red-500/60" : "",
					hasSuccess && uploadingCount === 0 ? "border-emerald-500/50" : "",
				)}
			>
				<div className="flex items-center justify-between gap-3">
					<div className="min-w-0">
						<div className="text-sm font-medium">
							Drop files here
							<span className="text-white/50"> or </span>
							<button
								type="button"
								className="underline underline-offset-2 hover:text-white"
								onClick={() => inputRef.current?.click()}
								disabled={!projectId}
							>
								browse
							</button>
						</div>
						<div className="text-xs text-white/50">
							Up to 500MB • mp4/webm/mov • jpg/png/gif/webp/svg • mp3/aac/wav/ogg
						</div>
						{!projectId ? (
							<div className="text-xs text-red-300">Select a project to upload.</div>
						) : null}
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => inputRef.current?.click()}
						disabled={!projectId}
					>
						<UploadIcon className="h-4 w-4" />
						Browse files
					</Button>
					<input
						ref={inputRef}
						type="file"
						multiple
						className="hidden"
						accept={Array.from(ACCEPTED_MIME_TYPES).join(",")}
						onChange={(e) => handleFiles(e.target.files)}
					/>
				</div>
			</div>

			{items.length > 0 ? (
				<div className="space-y-1">
					{items.slice(0, 6).map((it) => (
						<div key={it.id} className="rounded-md border border-white/10 bg-black/20 p-2">
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0 truncate text-xs text-white/80">
									{it.file.name}
								</div>
								<div className="flex shrink-0 items-center gap-2">
									{it.status === "uploading" ? (
										<button
											type="button"
											className="text-[11px] text-white/60 underline underline-offset-2 hover:text-white"
											onClick={() => {
												it.controller?.abort();
												setItems((prev) =>
													prev.map((x) =>
														x.id === it.id ? { ...x, status: "cancelled", controller: undefined } : x,
													),
												);
											}}
										>
											Cancel
										</button>
									) : null}
									<div className="text-[11px] text-white/50">
										{it.status === "success"
											? "Done"
											: it.status === "error"
												? "Error"
												: it.status === "cancelled"
													? "Cancelled"
													: `${it.progress}%`}
									</div>
								</div>
							</div>
							<div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10">
								<div
									className={cn(
										"h-full",
										it.status === "error"
											? "bg-red-500"
											: it.status === "success"
												? "bg-emerald-500"
												: "bg-brand",
									)}
									style={{ width: `${Math.max(0, Math.min(100, it.progress))}%` }}
								/>
							</div>
							{it.error ? (
								<div className="mt-1 text-[11px] text-red-300">{it.error}</div>
							) : null}
						</div>
					))}
					{items.length > 6 ? (
						<div className="text-xs text-white/40">+{items.length - 6} more</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
