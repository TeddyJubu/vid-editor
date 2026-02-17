import { GoogleGenerativeAI } from "@google/generative-ai";

import { createClient } from "@/lib/supabase/server";

import type {
  CaptionJob,
  CaptionResult,
  CaptionSegment,
  CaptionStyle,
} from "@/lib/types/caption";

type ProjectJsonRow = { project_json: unknown };

const jobs = new Map<string, CaptionJob>();

function getGeminiModel() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

type GeminiModel = NonNullable<ReturnType<typeof getGeminiModel>>;

function nowIso() {
  return new Date().toISOString();
}

function clampInt(v: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function extractDurationMs(projectJson: unknown): number {
  if (!projectJson || typeof projectJson !== "object") return 10_000;
  const obj = projectJson as Record<string, unknown>;
  const elements = obj.elements;
  if (!Array.isArray(elements) || elements.length === 0) return 10_000;

  let maxEndMs = 0;
  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const rec = el as Record<string, unknown>;
    const startMs = typeof rec.startMs === "number" ? rec.startMs : 0;
    const durationMs = typeof rec.durationMs === "number" ? rec.durationMs : 0;
    const endMs = startMs + durationMs;
    if (Number.isFinite(endMs) && endMs > maxEndMs) maxEndMs = endMs;
  }

  const ms = clampInt(maxEndMs, 1000, 60 * 60 * 1000);
  return ms > 0 ? ms : 10_000;
}

async function fetchCurrentProjectJson(
  projectId: string,
  workspaceId: string,
): Promise<unknown> {
  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,current_version_id")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (projectError) throw new Error(projectError.message);
  const versionId = (project as { current_version_id?: string | null } | null)
    ?.current_version_id;
  if (!versionId) return null;

  const { data: version, error: versionError } = await supabase
    .from("project_versions")
    .select("project_json")
    .eq("id", versionId)
    .maybeSingle();

  if (versionError) throw new Error(versionError.message);
  return (version as ProjectJsonRow | null)?.project_json ?? null;
}

function pickWordsStream(): string[] {
  const samples = [
    "Welcome to your AI video editor",
    "Let us add clean captions to your timeline",
    "This is mock transcription output for preview",
    "You can regenerate captions in different styles",
    "Timing is aligned to the project duration",
    "Edit text and style later in the inspector",
  ];
  const text = samples.join(" ");
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function extractLikelyJsonArray(text: string): string {
  const t = stripCodeFences(text);
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini did not return a JSON array");
  }
  return t.slice(start, end + 1);
}

function buildProjectContext(projectJson: unknown, durationMs: number) {
  const ctx: {
    title?: string;
    durationMs: number;
    elementTypeCounts?: Record<string, number>;
    textSamples?: string[];
  } = { durationMs };

  if (!projectJson || typeof projectJson !== "object") return ctx;
  const obj = projectJson as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title : typeof obj.name === "string" ? obj.name : undefined;
  if (title) ctx.title = title;

  const elements = obj.elements;
  if (!Array.isArray(elements)) return ctx;

  const counts: Record<string, number> = {};
  const texts: string[] = [];

  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const rec = el as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : "unknown";
    counts[type] = (counts[type] ?? 0) + 1;

    if (typeof rec.text === "string") {
      const s = rec.text.trim();
      if (s) texts.push(s);
    }
    if (typeof rec.name === "string") {
      const s = rec.name.trim();
      if (s) texts.push(s);
    }
  }

  ctx.elementTypeCounts = counts;
  ctx.textSamples = texts.slice(0, 12);
  return ctx;
}

function toIntMs(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function validateAndNormalizeSegments(
  parsed: unknown,
  durationMs: number,
  style: CaptionStyle,
): CaptionSegment[] {
  if (!Array.isArray(parsed)) throw new Error("Gemini JSON was not an array");
  if (parsed.length === 0) throw new Error("Gemini returned no caption segments");

  const totalMs = Math.max(1000, clampInt(durationMs, 1000, 60 * 60 * 1000));

  const segments: CaptionSegment[] = parsed.map((raw, idx) => {
    if (!raw || typeof raw !== "object") throw new Error(`Invalid segment at index ${idx}`);
    const rec = raw as Record<string, unknown>;

    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    const startMsRaw = toIntMs(rec.startMs);
    const endMsRaw = toIntMs(rec.endMs);
    if (!text) throw new Error(`Missing text at index ${idx}`);
    if (startMsRaw === null || endMsRaw === null) {
      throw new Error(`Missing startMs/endMs at index ${idx}`);
    }

    const startMs = clampInt(startMsRaw, 0, totalMs);
    const endMs = clampInt(endMsRaw, 0, totalMs);
    if (endMs <= startMs) throw new Error(`Invalid timing at index ${idx}`);

    const seg: CaptionSegment = { text, startMs, endMs };

    if (style === "word_by_word") {
      const wordsRaw = rec.words;
      if (Array.isArray(wordsRaw) && wordsRaw.length > 0) {
        const words = wordsRaw.map((w, wIdx) => {
          if (!w || typeof w !== "object") throw new Error(`Invalid word at ${idx}:${wIdx}`);
          const wRec = w as Record<string, unknown>;
          const wText = typeof wRec.text === "string" ? wRec.text.trim() : "";
          const wStartRaw = toIntMs(wRec.startMs);
          const wEndRaw = toIntMs(wRec.endMs);
          if (!wText) throw new Error(`Missing word text at ${idx}:${wIdx}`);
          if (wStartRaw === null || wEndRaw === null) throw new Error(`Missing word timing at ${idx}:${wIdx}`);
          const wStart = clampInt(wStartRaw, startMs, endMs);
          const wEnd = clampInt(wEndRaw, startMs, endMs);
          if (wEnd <= wStart) throw new Error(`Invalid word timing at ${idx}:${wIdx}`);
          return { text: wText, startMs: wStart, endMs: wEnd };
        });
        seg.words = words;
      } else {
        // Fallback: derive per-word timings from the segment's timing.
        const split = text.split(/\s+/).map((w) => w.trim()).filter(Boolean);
        if (split.length === 0) throw new Error(`No words to derive at index ${idx}`);
        const segDur = Math.max(1, endMs - startMs);
        const per = Math.max(40, Math.floor(segDur / split.length));
        const words = split.map((w, i) => {
          const wStart = startMs + i * per;
          const wEnd = i === split.length - 1 ? endMs : Math.min(endMs, wStart + per);
          return { text: w, startMs: wStart, endMs: wEnd };
        });
        seg.words = words;
      }
    }

    return seg;
  });

  segments.sort((a, b) => a.startMs - b.startMs);
  return segments;
}

async function generateCaptionsWithGemini(
  model: GeminiModel,
  projectJson: unknown,
  durationMs: number,
  style: CaptionStyle,
): Promise<CaptionSegment[]> {
  const totalMs = Math.max(1000, clampInt(durationMs, 1000, 60 * 60 * 1000));
  const context = buildProjectContext(projectJson, totalMs);

  const styleHint =
    style === "word_by_word"
      ? "Create short segments (1-3 words each) and INCLUDE words[] with per-word timing."
      : style === "paragraph"
        ? "Create paragraph-length segments (roughly 10-15 seconds each)."
        : "Create sentence-length segments (roughly 3-5 seconds each).";

  const prompt =
    "You are generating captions for a video editor timeline. " +
    "Return ONLY valid JSON (no markdown) matching this TypeScript type: " +
    "Array<{ text: string; startMs: number; endMs: number; words?: Array<{ text: string; startMs: number; endMs: number }> }>. " +
    `All times are integer milliseconds. startMs>=0, endMs<=${totalMs}, endMs>startMs. ` +
    "Segments should be in chronological order. " +
    `${styleHint} ` +
    "If style is word_by_word, each segment MUST have a words array whose timings fit within the segment. " +
    "Use the project context to invent plausible spoken narration; there is no audio provided. " +
    "Project context JSON: " +
    JSON.stringify({ style, ...context });

  const res = await model.generateContent(prompt);
  const text = res?.response?.text?.();
  if (!text) throw new Error("Gemini returned empty response");

  const json = extractLikelyJsonArray(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Failed to parse Gemini JSON");
  }

  return validateAndNormalizeSegments(parsed, totalMs, style);
}

async function generateCaptions(
  projectJson: unknown,
  durationMs: number,
  style: CaptionStyle,
): Promise<CaptionSegment[]> {
  const model = getGeminiModel();
  if (!model) {
    console.warn("[captions] GOOGLE_GEMINI_API_KEY not set – using mock captions");
    return generateMockCaptions(durationMs, style);
  }
  try {
    return await generateCaptionsWithGemini(model, projectJson, durationMs, style);
  } catch (err) {
    console.warn(
      "[captions] Gemini API failed, falling back to mock:",
      err instanceof Error ? err.message : err,
    );
    return generateMockCaptions(durationMs, style);
  }
}

export function generateMockCaptions(
  durationMs: number,
  style: CaptionStyle,
): CaptionSegment[] {
  const totalMs = Math.max(1000, clampInt(durationMs, 1000, 60 * 60 * 1000));

  if (style === "word_by_word") {
    const stream = pickWordsStream();
    const segMs = 500;
    const segments: CaptionSegment[] = [];
    let t = 0;
    let wordIndex = 0;
    while (t < totalMs) {
      const startMs = t;
      const endMs = Math.min(totalMs, startMs + segMs);
      const wordsThisSeg = Math.max(1, Math.min(2, stream.length - wordIndex));

      const words = [] as { text: string; startMs: number; endMs: number }[];
      const perWord = Math.max(80, Math.floor((endMs - startMs) / wordsThisSeg));
      for (let i = 0; i < wordsThisSeg; i += 1) {
        const w = stream[wordIndex % stream.length] ?? "...";
        const wStart = startMs + i * perWord;
        const wEnd = i === wordsThisSeg - 1 ? endMs : Math.min(endMs, wStart + perWord);
        words.push({ text: w, startMs: wStart, endMs: wEnd });
        wordIndex += 1;
      }

      const text = words.map((w) => w.text).join(" ");
      segments.push({ text, startMs, endMs, words });
      t = endMs;
    }
    return segments;
  }

  if (style === "paragraph") {
    const segMin = 10_000;
    const segMax = 15_000;
    const segments: CaptionSegment[] = [];
    let t = 0;
    let i = 0;
    const paragraphs = [
      "This is a longer caption block for preview. It represents a paragraph-level grouping of speech.",
      "Use paragraph captions when you want fewer timeline items. You can refine them later.",
      "Captions help viewers follow along and improve accessibility.",
    ];
    while (t < totalMs) {
      const len = clampInt(segMin + (i % 3) * 1500, segMin, segMax);
      const startMs = t;
      const endMs = Math.min(totalMs, startMs + len);
      const text = paragraphs[i % paragraphs.length] ?? "";
      segments.push({ text, startMs, endMs });
      t = endMs;
      i += 1;
    }
    return segments;
  }

  // sentence (default)
  const segMin = 3000;
  const segMax = 5000;
  const segments: CaptionSegment[] = [];
  let t = 0;
  let i = 0;
  const sentences = [
    "Generating captions for your project.",
    "This is a mock transcript segment for preview.",
    "You can choose word-by-word, sentence, or paragraph styles.",
    "Captions were aligned with the project timeline.",
    "You can edit or delete these captions at any time.",
  ];
  while (t < totalMs) {
    const len = clampInt(segMin + (i % 4) * 500, segMin, segMax);
    const startMs = t;
    const endMs = Math.min(totalMs, startMs + len);
    const text = sentences[i % sentences.length] ?? "";
    segments.push({ text, startMs, endMs });
    t = endMs;
    i += 1;
  }
  return segments;
}

export async function startCaptionJob(
  projectId: string,
  workspaceId: string,
  style: CaptionStyle,
): Promise<CaptionJob> {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const job: CaptionJob = {
    id,
    projectId,
    status: "pending",
    style,
    result: null,
    error: null,
    createdAt,
    completedAt: null,
  };

  jobs.set(id, job);

  // Simulate async processing.
  const processingDelayMs = clampInt(2000 + Math.floor(Math.random() * 2000), 2000, 4000);
  setTimeout(() => {
    const current = jobs.get(id);
    if (!current) return;
    jobs.set(id, { ...current, status: "processing" });

    setTimeout(() => {
      const cur2 = jobs.get(id);
      if (!cur2) return;

      (async () => {
        try {
          const projectJson = await fetchCurrentProjectJson(projectId, workspaceId);
          const durationMs = extractDurationMs(projectJson);
          const segments = await generateCaptions(projectJson, durationMs, style);
          const result: CaptionResult = { segments };
          const completedAt = nowIso();
          jobs.set(id, {
            ...cur2,
            status: "completed",
            result,
            error: null,
            completedAt,
          });
        } catch (err) {
          const completedAt = nowIso();
          jobs.set(id, {
            ...cur2,
            status: "failed",
            result: null,
            error: err instanceof Error ? err.message : "Caption generation failed",
            completedAt,
          });
        }
      })();
    }, processingDelayMs);
  }, 0);

  return job;
}

export function getCaptionJob(jobId: string): CaptionJob | null {
  return jobs.get(jobId) ?? null;
}
