"use client";

import type { RenderTier } from "@/lib/services/render-service";
import { muxVp8Webm } from "@/lib/render/webm-muxer";

export type RenderProgress = {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
};

export type DraftRenderResult = {
  blob: Blob;
  url: string;
  mimeType: string;
};

type EncodedVideoChunkLike = {
  byteLength: number;
  timestamp?: number;
  type?: string;
  copyTo: (dest: Uint8Array) => void;
};

type VideoEncoderConfigLike = {
  codec: string;
  width: number;
  height: number;
  framerate: number;
  bitrate: number;
};

type VideoEncoderLike = {
  configure: (config: VideoEncoderConfigLike) => void;
  encode: (frame: unknown, options?: { keyFrame?: boolean }) => void;
  flush: () => Promise<void>;
  close: () => void;
};

type VideoEncoderCtorLike = {
  new (init: { output: (chunk: EncodedVideoChunkLike) => void; error: (e: unknown) => void }): VideoEncoderLike;
  isConfigSupported: (config: VideoEncoderConfigLike) => Promise<{ supported: boolean }>;
};

type VideoFrameLike = { close: () => void };

type VideoFrameCtorLike = new (source: unknown, init: { timestamp: number }) => VideoFrameLike;

function getWebCodecsCtors(): { VideoEncoder: VideoEncoderCtorLike; VideoFrame: VideoFrameCtorLike } {
  const g = globalThis as unknown as Record<string, unknown>;
  const ve = g.VideoEncoder;
  const vf = g.VideoFrame;

  if (typeof ve !== "function") {
    throw new Error("WebCodecs VideoEncoder missing");
  }
  const veRec = ve as unknown as Record<string, unknown>;
  if (typeof veRec.isConfigSupported !== "function") {
    throw new Error("WebCodecs VideoEncoder.isConfigSupported missing");
  }
  if (typeof vf !== "function") {
    throw new Error("WebCodecs VideoFrame missing");
  }

  return {
    VideoEncoder: ve as unknown as VideoEncoderCtorLike,
    VideoFrame: vf as unknown as VideoFrameCtorLike,
  };
}

const qualityMultipliers: Record<RenderTier, number> = {
  draft: 1.0,
  standard: 1.35,
  pro: 1.8,
  ultra: 2.5,
};

function clampInt(v: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

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

function extractFormat(projectJson: unknown): { width: number; height: number; fps: number } {
  if (!projectJson || typeof projectJson !== "object") {
    return { width: 1280, height: 720, fps: 30 };
  }
  const obj = projectJson as Record<string, unknown>;
  const fmt = obj.format;
  if (!fmt || typeof fmt !== "object") {
    return { width: 1280, height: 720, fps: 30 };
  }
  const f = fmt as Record<string, unknown>;
  return {
    width: clampInt(typeof f.width === "number" ? f.width : 1280, 16, 16384),
    height: clampInt(typeof f.height === "number" ? f.height : 720, 16, 16384),
    fps: Math.min(Math.max(typeof f.fps === "number" && Number.isFinite(f.fps) ? f.fps : 30, 1), 240),
  };
}

export function checkWebCodecsSupport(): boolean {
  if (typeof window === "undefined") return false;
  const g = globalThis as unknown as Record<string, unknown>;
  const hasEncoder = typeof g.VideoEncoder === "function";
  const hasFrame = typeof g.VideoFrame === "function";
  const secureOk = typeof (globalThis as unknown as { isSecureContext?: boolean }).isSecureContext === "boolean"
    ? Boolean((globalThis as unknown as { isSecureContext?: boolean }).isSecureContext)
    : true;
  return hasEncoder && hasFrame && secureOk;
}

export function estimateRenderUnits(projectJson: unknown, tier: RenderTier): number {
  const durationSeconds = Math.max(extractDurationSeconds(projectJson), 0);
  const { width, height, fps } = extractFormat(projectJson);
  const fpsFactor = Math.max(fps, 1) / 30;
  const pixels = Math.max(width, 1) * Math.max(height, 1);
  const pixelFactor = pixels / 921_600;
  const mult = qualityMultipliers[tier] ?? 1.0;
  return Math.max(0, Math.ceil(durationSeconds * fpsFactor * pixelFactor * mult));
}

function assertNotAborted(signal?: AbortSignal) {
  if (!signal) return;
  if (signal.aborted) {
    throw new DOMException("Render cancelled", "AbortError");
  }
}

function makeCanvas(width: number, height: number):
  | { kind: "offscreen"; canvas: OffscreenCanvas }
  | { kind: "dom"; canvas: HTMLCanvasElement } {
  if (typeof OffscreenCanvas !== "undefined") {
    return { kind: "offscreen", canvas: new OffscreenCanvas(width, height) };
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return { kind: "dom", canvas: c };
}

function drawStubFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  title: string,
) {
  ctx.clearRect(0, 0, width, height);
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#111827");
  g.addColorStop(1, "#4f46e5");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  const x = Math.round((width * 0.1) + Math.sin(t * 2) * width * 0.05);
  const y = Math.round((height * 0.2) + Math.cos(t * 1.5) * height * 0.05);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(x, y, Math.round(width * 0.35), Math.round(height * 0.22));

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `${Math.max(14, Math.round(height * 0.045))}px ui-sans-serif, system-ui`;
  ctx.fillText(title || "VidEditor Draft", Math.round(width * 0.08), Math.round(height * 0.12));
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `${Math.max(12, Math.round(height * 0.03))}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.fillText(`t=${t.toFixed(2)}s`, Math.round(width * 0.08), Math.round(height * 0.18));
}

export async function renderDraft(
  projectJson: unknown,
  options: {
    tier?: RenderTier;
    durationSeconds?: number;
    width?: number;
    height?: number;
    fps?: number;
    signal?: AbortSignal;
  } = {},
  onProgress?: (p: RenderProgress) => void,
): Promise<DraftRenderResult> {
  if (!checkWebCodecsSupport()) {
    throw new Error(
      "WebCodecs is not available in this browser/context. Try Chrome/Edge in a secure context (https/localhost).",
    );
  }

  const { VideoEncoder, VideoFrame } = getWebCodecsCtors();

  assertNotAborted(options.signal);

  const baseFmt = extractFormat(projectJson);
  const width = clampInt(options.width ?? baseFmt.width, 16, 16384);
  const height = clampInt(options.height ?? baseFmt.height, 16, 16384);
  const fps = Math.min(Math.max(options.fps ?? baseFmt.fps, 1), 240);
  const durationSeconds = Math.max(options.durationSeconds ?? extractDurationSeconds(projectJson), 0.1);
  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));

  const canvas = makeCanvas(width, height);
	const ctx =
		canvas.kind === "offscreen"
			? canvas.canvas.getContext("2d", { alpha: false })
			: canvas.canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Failed to create 2D canvas context");

  const chunks: { data: Uint8Array; timestampMs: number; keyframe: boolean }[] = [];
	const encoder = new VideoEncoder({
	  output(chunk: EncodedVideoChunkLike) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      const tsUs = typeof chunk.timestamp === "number" ? chunk.timestamp : 0;
      chunks.push({
        data,
        timestampMs: Math.round(tsUs / 1000),
        keyframe: chunk.type === "key",
      });
    },
    error(e: unknown) {
      throw e instanceof Error ? e : new Error("VideoEncoder error");
    },
  });

	const config: VideoEncoderConfigLike = {
    codec: "vp8",
    width,
    height,
    framerate: fps,
    bitrate: Math.round(width * height * fps * 0.08),
  };

	const supported = await VideoEncoder.isConfigSupported(config);
  if (!supported?.supported) {
    throw new Error("VP8 VideoEncoder config not supported in this browser");
  }
  encoder.configure(config);

  const start = performance.now();
  const frameDurationUs = Math.round(1_000_000 / fps);
	const title = (() => {
	  if (!projectJson || typeof projectJson !== "object") return "VidEditor Draft";
	  const rec = projectJson as Record<string, unknown>;
	  return typeof rec.title === "string" ? rec.title : "VidEditor Draft";
	})();

  for (let i = 0; i < totalFrames; i += 1) {
    assertNotAborted(options.signal);
    const tSec = i / fps;
    drawStubFrame(ctx, width, height, tSec, title);
    const timestampUs = i * frameDurationUs;
	  const frame = new VideoFrame(canvas.canvas, {
      timestamp: timestampUs,
    });
    encoder.encode(frame, { keyFrame: i === 0 || i % Math.max(1, Math.round(fps)) === 0 });
    frame.close();

    if (onProgress) {
      const elapsedMs = performance.now() - start;
      const currentFrame = i + 1;
      const percent = Math.min(100, Math.max(0, (currentFrame / totalFrames) * 100));
      const estimatedRemainingMs = currentFrame > 0 ? Math.max(0, (elapsedMs / currentFrame) * (totalFrames - currentFrame)) : null;
      onProgress({ currentFrame, totalFrames, percent, elapsedMs, estimatedRemainingMs });
    }
  }

  assertNotAborted(options.signal);
  await encoder.flush();
  encoder.close();

  assertNotAborted(options.signal);
  const webm = muxVp8Webm({ width, height, fps, chunks });
	const webmBytes = new Uint8Array(webm);
  const mimeType = "video/webm";
	const blob = new Blob([webmBytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  return { blob, url, mimeType };
}
