import { createClient } from "@/lib/supabase/server";

import type {
  CaptionJob,
  CaptionResult,
  CaptionSegment,
  CaptionStyle,
} from "@/lib/types/caption";

type ProjectJsonRow = { project_json: unknown };

const jobs = new Map<string, CaptionJob>();

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
          const segments = generateMockCaptions(durationMs, style);
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
