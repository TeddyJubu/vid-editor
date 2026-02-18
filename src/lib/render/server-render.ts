import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

import type { BrowserManager } from "agent-browser/dist/browser.js";

export function clampInt(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export function extractDurationSeconds(projectJson: unknown): number {
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

export function extractFormat(projectJson: unknown): { width: number; height: number; fps: number } {
  if (!projectJson || typeof projectJson !== "object") {
    return { width: 1920, height: 1080, fps: 30 };
  }
  const obj = projectJson as Record<string, unknown>;
  const fmt = obj.format;
  if (!fmt || typeof fmt !== "object") {
    return { width: 1920, height: 1080, fps: 30 };
  }
  const f = fmt as Record<string, unknown>;
  return {
    width: clampInt(typeof f.width === "number" ? f.width : 1920, 16, 16384),
    height: clampInt(typeof f.height === "number" ? f.height : 1080, 16, 16384),
    fps: Math.min(
      Math.max(typeof f.fps === "number" && Number.isFinite(f.fps) ? f.fps : 30, 1),
      240,
    ),
  };
}

export function ensureEven(n: number): number {
  const v = Math.max(0, Math.trunc(n));
  return v % 2 === 0 ? v : v - 1;
}

function safeJsonForInlineScript(value: unknown): string {
  // Avoid accidentally closing the <script> tag when embedding JSON.
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

async function encodeMp4FromJpegFrames(inputPattern: string, fps: number, outputPath: string) {
  interface FfmpegCommandLike {
    input: (p: string) => FfmpegCommandLike;
    inputOptions: (opts: string[]) => FfmpegCommandLike;
    outputOptions: (opts: string[]) => FfmpegCommandLike;
    on(event: "end", handler: () => void): FfmpegCommandLike;
    on(event: "error", handler: (err: unknown) => void): FfmpegCommandLike;
    save: (out: string) => void;
  }

  type FfmpegLike = (() => FfmpegCommandLike) & {
    setFfmpegPath?: (p: string) => void;
  };

  const mod = await import("fluent-ffmpeg");

  const ffmpeg =
    ((mod as unknown as { default?: unknown }).default ?? mod) as unknown as FfmpegLike;

  // Turbopack currently has trouble bundling @ffmpeg-installer/ffmpeg because it uses
  // dynamic requires. Instead, we try to locate the platform binary under node_modules
  // at runtime and point fluent-ffmpeg at it. Fallback is relying on `ffmpeg` being on PATH.
  const envFfmpegPath = process.env.FFMPEG_PATH;
  if (typeof envFfmpegPath === "string" && envFfmpegPath.length > 0 && ffmpeg.setFfmpegPath) {
    ffmpeg.setFfmpegPath(envFfmpegPath);
  } else if (ffmpeg.setFfmpegPath) {
    const binName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const installerDir = path.join(process.cwd(), "node_modules", "@ffmpeg-installer");
    try {
      const entries = await fs.readdir(installerDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        if (ent.name === "ffmpeg") continue;
        const candidate = path.join(installerDir, ent.name, binName);
        try {
          await fs.access(candidate);
          ffmpeg.setFfmpegPath(candidate);
          break;
        } catch {
          // try next
        }
      }
    } catch {
      // ignore; we'll rely on PATH
    }
  }

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(inputPattern)
      .inputOptions(["-framerate", String(fps)])
      .outputOptions([
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-r",
        String(fps),
      ])
      .on("end", () => resolve())
      .on("error", (err: unknown) => reject(err))
      .save(outputPath);
  });
}

function shouldSimulateFailure(projectJson: unknown): boolean {
  if (!projectJson || typeof projectJson !== "object") return false;
  const obj = projectJson as Record<string, unknown>;
  if (obj.__simulateRenderFailure === true) return true;
  const render = obj.render;
  if (render && typeof render === "object") {
    const r = render as Record<string, unknown>;
    if (r.simulateFailure === true) return true;
    const failRate = typeof r.failRate === "number" ? r.failRate : null;
    if (failRate !== null && Number.isFinite(failRate) && failRate > 0) {
      return Math.random() < Math.min(Math.max(failRate, 0), 1);
    }
  }
  return false;
}

export type StubRenderResult = {
  storageKey: string;
  format: "mp4";
  sizeBytes: number;
};

/**
 * Server-side render worker.
 * Renders frames in headless Chromium (agent-browser / Playwright) and encodes to MP4 via FFmpeg.
 */
export async function processRenderJob(
  jobId: string,
  projectJson: unknown,
): Promise<StubRenderResult> {
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("render_jobs")
    .select("workspace_id")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!job?.workspace_id) throw new Error("Render job not found");

  if (shouldSimulateFailure(projectJson)) throw new Error("Simulated render failure");

  const workspaceId = job.workspace_id;
  const storageKey = `renders/${workspaceId}/${jobId}/output.mp4`;

  const baseFmt = extractFormat(projectJson);
  const width = ensureEven(baseFmt.width);
  const height = ensureEven(baseFmt.height);
  const fps = baseFmt.fps;
  const durationSeconds = Math.max(extractDurationSeconds(projectJson), 0.1);
  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `render-${jobId}-`));
  const framesDir = path.join(tmpDir, "frames");
  await fs.mkdir(framesDir, { recursive: true });
  const outputMp4Path = path.join(tmpDir, "output.mp4");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=${width}, height=${height}, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; background: #000; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <canvas id="c" width="${width}" height="${height}"></canvas>
    <script>
      const projectJson = ${safeJsonForInlineScript(projectJson)};
      const canvas = document.getElementById("c");
      const ctx = canvas.getContext("2d", { alpha: false });
      const images = new Map();

      function isActive(el, tMs) {
        const startMs = typeof el.startMs === "number" ? el.startMs : 0;
        const durationMs = typeof el.durationMs === "number" ? el.durationMs : 0;
        return tMs >= startMs && tMs < (startMs + durationMs);
      }

      function clearBg() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#0b1020";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      function drawText(el) {
        const x = typeof el.x === "number" ? el.x : 0;
        const y = typeof el.y === "number" ? el.y : 0;
        const fontSize = typeof el.fontSize === "number" ? el.fontSize : 24;
        const color = typeof el.color === "string" ? el.color : "#ffffff";
        const text = typeof el.text === "string" ? el.text : "";
        ctx.fillStyle = color;
        ctx.font =
          String(Math.max(8, Math.round(fontSize))) +
          "px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
        ctx.textBaseline = "top";
        ctx.fillText(text, x, y);
      }

      function drawShape(el) {
        const shape = typeof el.shape === "string" ? el.shape : "rect";
        const x = typeof el.x === "number" ? el.x : 0;
        const y = typeof el.y === "number" ? el.y : 0;
        const w = typeof el.width === "number" ? el.width : 100;
        const h = typeof el.height === "number" ? el.height : 100;
        const fill = typeof el.fill === "string" ? el.fill : "rgba(255,255,255,0.25)";
        ctx.fillStyle = fill;
        if (shape === "circle") {
          const r = Math.max(1, Math.min(w, h) / 2);
          ctx.beginPath();
          ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        ctx.fillRect(x, y, w, h);
      }

      function drawCaption(el) {
        const text = typeof el.text === "string" ? el.text : "";
        if (!text) return;
        const pad = Math.round(canvas.height * 0.06);
        const fontSize = Math.max(14, Math.round(canvas.height * 0.04));
        ctx.font =
          String(fontSize) +
          "px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
        ctx.textBaseline = "bottom";
        const metrics = ctx.measureText(text);
        const w = Math.min(canvas.width - pad * 2, Math.ceil(metrics.width) + pad);
        const h = fontSize + pad;
        const x = Math.round((canvas.width - w) / 2);
        const y = canvas.height - pad;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(x, y - h, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, x + Math.round(pad / 2), y - Math.round(pad / 3));
      }

      function drawImage(el) {
        const src = typeof el.src === "string" ? el.src : "";
        if (!src) return;
        const img = images.get(src);
        if (!img) return;
        // Simple fit-to-canvas; no transforms for now.
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } catch {
          // ignore
        }
      }

      window.__prepareAssets = async () => {
        const els = projectJson && typeof projectJson === "object" ? projectJson.elements : null;
        const list = Array.isArray(els) ? els : [];
        const urls = [];
        for (const el of list) {
          if (!el || typeof el !== "object") continue;
          if (el.type === "image" && typeof el.src === "string") urls.push(el.src);
        }
        await Promise.all(
          urls.map(
            (u) =>
              new Promise((resolve) => {
                if (images.has(u)) return resolve(null);
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                  images.set(u, img);
                  resolve(null);
                };
                img.onerror = () => resolve(null);
                img.src = u;
              }),
          ),
        );
      };

      window.__drawAtMs = (tMs) => {
        clearBg();
        const els = projectJson && typeof projectJson === "object" ? projectJson.elements : null;
        const list = Array.isArray(els) ? els : [];
        for (const el of list) {
          if (!el || typeof el !== "object") continue;
          if (!isActive(el, tMs)) continue;
          if (el.type === "image") drawImage(el);
          else if (el.type === "shape") drawShape(el);
          else if (el.type === "text") drawText(el);
          else if (el.type === "caption") drawCaption(el);
        }
      };
    </script>
  </body>
</html>`;

  let browser: BrowserManager | null = null;
  try {
    const mod = await import("agent-browser/dist/browser.js");
    const Manager = mod.BrowserManager as unknown as {
      new (): BrowserManager;
    };

    browser = new Manager();
    await browser.launch({
      id: `render-${jobId}-launch`,
      action: "launch",
      headless: true,
      browser: "chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      viewport: { width, height },
    });

    await browser.ensurePage();
    await browser.setViewport(width, height);

    const page = browser.getPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      const w = window as unknown as { __prepareAssets?: () => Promise<void> };
      if (w.__prepareAssets) await w.__prepareAssets();
    });

    for (let i = 0; i < totalFrames; i += 1) {
      const tMs = (i / fps) * 1000;
      await page.evaluate((ms: number) => {
        const w = window as unknown as { __drawAtMs?: (t: number) => void };
        if (w.__drawAtMs) w.__drawAtMs(ms);
      }, tMs);

      const frameName = `frame-${String(i + 1).padStart(6, "0")}.jpg`;
      const framePath = path.join(framesDir, frameName);
      await page.screenshot({
        path: framePath,
        type: "jpeg",
        quality: 80,
      });
    }

    const inputPattern = path.join(framesDir, "frame-%06d.jpg");
    await encodeMp4FromJpegFrames(inputPattern, fps, outputMp4Path);

    const stat = await fs.stat(outputMp4Path);
    const sizeBytes = stat.size;

    const admin = createServiceRoleClient();
    const mp4 = await fs.readFile(outputMp4Path);
    const { error: uploadError } = await admin.storage
      .from("assets")
      .upload(storageKey, mp4, { contentType: "video/mp4", upsert: true });

    if (uploadError) throw new Error(uploadError.message);

    return { storageKey, format: "mp4", sizeBytes };
  } finally {
    await browser?.close().catch(() => undefined);
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
