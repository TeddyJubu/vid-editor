export type CaptionJobStatus = "pending" | "processing" | "completed" | "failed";
export type CaptionStyle = "word_by_word" | "sentence" | "paragraph";

export type CaptionResult = { segments: CaptionSegment[] };

export type CaptionSegment = {
  text: string;
  startMs: number;
  endMs: number;
  words?: { text: string; startMs: number; endMs: number }[];
};

export type CaptionJob = {
  id: string;
  projectId: string;
  status: CaptionJobStatus;
  style: CaptionStyle;
  result: CaptionResult | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};
