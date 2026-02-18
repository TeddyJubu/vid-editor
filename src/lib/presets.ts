export type FormatPreset = {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  fps: number | null;
  aspectRatioLabel: string;
};

export const FORMAT_PRESETS = [
  {
    id: "portrait_9_16",
    name: "Portrait (9:16)",
    width: 1080,
    height: 1920,
    fps: 30,
    aspectRatioLabel: "9:16",
  },
  {
    id: "square_1_1",
    name: "Square (1:1)",
    width: 1080,
    height: 1080,
    fps: 30,
    aspectRatioLabel: "1:1",
  },
  {
    id: "reel_story_9_16",
    name: "Reel / Story (9:16)",
    width: 1080,
    height: 1920,
    fps: 30,
    aspectRatioLabel: "9:16",
  },
  {
    id: "square_post_1_1",
    name: "Square Post (1:1)",
    width: 1080,
    height: 1080,
    fps: 30,
    aspectRatioLabel: "1:1",
  },
  {
    id: "landscape_16_9",
    name: "Landscape (16:9)",
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatioLabel: "16:9",
  },
  {
    id: "youtube_short_9_16_60",
    name: "YouTube Short (9:16)",
    width: 1080,
    height: 1920,
    fps: 60,
    aspectRatioLabel: "9:16",
  },
  {
    id: "tiktok_9_16",
    name: "TikTok (9:16)",
    width: 1080,
    height: 1920,
    fps: 30,
    aspectRatioLabel: "9:16",
  },
  {
    id: "twitter_x_16_9",
    name: "Twitter/X Video (16:9)",
    width: 1280,
    height: 720,
    fps: 30,
    aspectRatioLabel: "16:9",
  },
  {
    id: "linkedin_16_9",
    name: "LinkedIn Video (16:9)",
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatioLabel: "16:9",
  },
  {
    id: "facebook_reel_9_16",
    name: "Facebook Reel (9:16)",
    width: 1080,
    height: 1920,
    fps: 30,
    aspectRatioLabel: "9:16",
  },
  {
    id: "custom",
    name: "Custom",
    width: null,
    height: null,
    fps: null,
    aspectRatioLabel: "Custom",
  },
] as const satisfies readonly FormatPreset[];

export type FormatPresetId = (typeof FORMAT_PRESETS)[number]["id"];

const PRESET_BY_ID = new Map<FormatPresetId, (typeof FORMAT_PRESETS)[number]>(
  FORMAT_PRESETS.map((p) => [p.id, p]),
);

export function getFormatPresetById(id: FormatPresetId) {
  return PRESET_BY_ID.get(id);
}

export function isFormatPresetId(id: string): id is FormatPresetId {
  return PRESET_BY_ID.has(id as FormatPresetId);
}
