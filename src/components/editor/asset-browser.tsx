"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/format-file-size";
import { formatRelativeTime } from "@/lib/format-time";
import { useAssets, type Asset } from "@/hooks/use-assets";
import { UploadZone } from "@/components/upload-zone";
import { DotsIcon, ImageIcon, MusicIcon, PlayIcon } from "@/components/icons";
import { useTwickStudio } from "@/lib/twick";

type AssetTypeFilter = "all" | "video" | "image" | "audio";

function assetType(asset: Asset): Exclude<AssetTypeFilter, "all"> | "other" {
	if (asset.mime_type.startsWith("video/")) return "video";
	if (asset.mime_type.startsWith("image/")) return "image";
	if (asset.mime_type.startsWith("audio/")) return "audio";
	return "other";
}

function formatDuration(seconds: number | null): string {
	if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return "";
	const s = Math.floor(seconds);
	const mm = Math.floor(s / 60);
	const ss = s % 60;
	return `${mm}:${ss.toString().padStart(2, "0")}`;
}

function isHttpUrl(v: string | null): v is string {
	return typeof v === "string" && (v.startsWith("http://") || v.startsWith("https://"));
}

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

export function AssetBrowser({
	projectId,
	onClose,
}: Readonly<{ projectId: string; onClose?: () => void }>) {
	const { assets, loading, error, uploadAsset, deleteAsset } = useAssets(projectId);
	const { projectJson, setProjectJson, setSelectedElementId } = useTwickStudio();
	const [filter, setFilter] = React.useState<AssetTypeFilter>("all");
	const [query, setQuery] = React.useState("");
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const [actionError, setActionError] = React.useState<string | null>(null);
	const [busyAssetId, setBusyAssetId] = React.useState<string | null>(null);

	const filtered = React.useMemo(() => {
		const q = query.trim().toLowerCase();
		return assets.filter((a) => {
			const t = assetType(a);
			if (filter !== "all" && t !== filter) return false;
			if (q && !a.filename.toLowerCase().includes(q)) return false;
			return true;
		});
	}, [assets, filter, query]);

	const selected = assets.find((a) => a.id === selectedId) ?? null;

	const insertAsset = React.useCallback(
		async (asset: Asset) => {
			setActionError(null);
			setBusyAssetId(asset.id);
			try {
				const signedUrl = await getSignedUrl(asset.id);
				const id = globalThis.crypto?.randomUUID?.() ?? `el-${Math.random().toString(16).slice(2)}`;
				const kind = assetType(asset);
				const durationMs =
					typeof asset.duration_seconds === "number" && Number.isFinite(asset.duration_seconds) && asset.duration_seconds > 0
						? Math.round(asset.duration_seconds * 1000)
						: 5000;

				const next = {
					id,
					name: asset.filename,
					startMs: projectJson.timeline.currentTimeMs,
					durationMs,
					src: signedUrl,
					type: kind === "audio" ? "audio" : kind === "video" ? "video" : "image",
				} as const;

				setProjectJson({
					...projectJson,
					elements: [...projectJson.elements, next],
				});
				setSelectedElementId(id);
			} catch (err) {
				setActionError(err instanceof Error ? err.message : "Failed to insert asset");
			} finally {
				setBusyAssetId(null);
			}
		},
		[projectJson, setProjectJson, setSelectedElementId],
	);

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
		<aside className="flex h-full w-[340px] flex-col border-r border-white/10 bg-black/30">
			<div className="flex items-center justify-between gap-2 border-b border-white/10 p-3">
				<div className="text-sm font-semibold">Assets</div>
				<div className="flex items-center gap-2">
					{onClose ? (
						<button
							type="button"
							onClick={onClose}
							className="text-xs text-white/60 hover:text-white"
						>
							Close
						</button>
					) : null}
				</div>
			</div>

			<div className="p-3">
				<UploadZone projectId={projectId} uploadAsset={uploadAsset} />
			</div>

			<div className="flex items-center gap-2 px-3 pb-2">
				{(
					[
						["all", "All"],
						["video", "Video"],
						["image", "Image"],
						["audio", "Audio"],
					] as const
				).map(([id, label]) => (
					<button
						key={id}
						type="button"
						onClick={() => setFilter(id)}
						className={cn(
							"rounded-md border px-2 py-1 text-xs",
							filter === id
								? "border-white/20 bg-white/10 text-white"
								: "border-white/10 bg-transparent text-white/60 hover:bg-white/5",
						)}
					>
						{label}
					</button>
				))}
			</div>

			<div className="px-3 pb-3">
				<Input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search by filename…"
					className="h-9 border-white/10 bg-black/20 text-white placeholder:text-white/40"
				/>
			</div>

			<div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
				{error ? (
					<div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
						{error}
					</div>
				) : null}
				{actionError ? (
					<div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
						{actionError}
					</div>
				) : null}
				{loading ? (
					<div className="text-xs text-white/50">Loading assets…</div>
				) : filtered.length === 0 ? (
					<div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/60">
						<div className="font-medium text-white/80">No assets yet.</div>
						<div className="mt-1 text-xs">Drop files here or click Upload.</div>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-2">
						{filtered.map((a) => {
							const t = assetType(a);
							const isSelected = a.id === selectedId;
							return (
								<div
										key={a.id}
										onClick={() => {
											if (busyAssetId) return;
											setSelectedId(a.id);
											void insertAsset(a);
										}}
										onContextMenu={(e) => {
											e.preventDefault();
											setSelectedId(a.id);
										}}
										className={cn(
											"group relative cursor-pointer rounded-lg border p-2",
											"border-white/10 bg-black/20 hover:bg-white/5",
											isSelected ? "border-brand/60 bg-white/5" : "",
										)}
									>
										<div className="relative mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-md bg-black/40">
											{t === "image" && isHttpUrl(a.thumbnail_key) ? (
											// eslint-disable-next-line @next/next/no-img-element
												<img
													alt={a.filename}
													src={a.thumbnail_key}
													className="h-full w-full object-cover"
												/>
											) : t === "video" ? (
												<PlayIcon className="h-7 w-7 text-sky-300" />
											) : t === "audio" ? (
												<MusicIcon className="h-7 w-7 text-emerald-300" />
											) : (
												<ImageIcon className="h-7 w-7 text-violet-200" />
											)}

											<div className="absolute right-1 top-1">
												<DropdownMenu.Root>
													<DropdownMenu.Trigger asChild>
														<button
															type="button"
															className="rounded-md border border-white/10 bg-black/30 p-1 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
															onClick={(e) => e.stopPropagation()}
														>
															<DotsIcon className="h-4 w-4" />
														</button>
													</DropdownMenu.Trigger>
													<DropdownMenu.Content
														align="end"
														className="z-50 min-w-44 rounded-md border border-white/10 bg-[#0f1020] p-1 text-sm shadow-lg"
														sideOffset={6}
													>
														<DropdownMenu.Item
															className="cursor-pointer rounded px-2 py-1.5 text-white/80 outline-none hover:bg-white/5"
															onSelect={() => void insertAsset(a)}
														>
															Insert to Timeline
														</DropdownMenu.Item>
														<DropdownMenu.Item
															className="cursor-pointer rounded px-2 py-1.5 text-white/80 outline-none hover:bg-white/5"
															onSelect={() => void downloadAsset(a)}
														>
															Download
														</DropdownMenu.Item>
														<DropdownMenu.Separator className="my-1 h-px bg-white/10" />
														<DropdownMenu.Item
															className="cursor-pointer rounded px-2 py-1.5 text-red-200 outline-none hover:bg-red-500/10"
															onSelect={async () => {
																if (!confirm(`Delete ${a.filename}?`)) return;
																await deleteAsset(a.id);
																setSelectedId((cur) => (cur === a.id ? null : cur));
															}}
														>
															Delete
														</DropdownMenu.Item>
													</DropdownMenu.Content>
												</DropdownMenu.Root>
											</div>
										</div>

										<div className="min-w-0">
											<div className="truncate text-xs font-medium text-white/90">{a.filename}</div>
											<div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-white/50">
												<span>{formatFileSize(a.size_bytes)}</span>
												<span>{formatDuration(a.duration_seconds)}</span>
											</div>
											<div className="mt-0.5 text-[11px] text-white/40">{formatRelativeTime(a.created_at)}</div>
										</div>
									</div>
							);
						})}
					</div>
				)}
			</div>

			<div className="border-t border-white/10 p-3">
				<Button
					variant="primary"
					size="sm"
					disabled={!selected || busyAssetId !== null}
					onClick={() => (selected ? void insertAsset(selected) : undefined)}
					className="w-full"
				>
					{busyAssetId ? "Working…" : "Add to Timeline"}
				</Button>
			</div>
		</aside>
	);
}
