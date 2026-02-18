export type ElementType =
  | "text"
  | "shape"
  | "caption"
  | "video"
  | "audio"
  | "image";

export type BaseElement = {
  id: string;
  type: ElementType;
  startMs: number;
  durationMs: number;
  trackIndex?: number;
  name?: string;
};

export type TextElement = BaseElement & {
  type: "text";
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
};

export type ShapeElement = BaseElement & {
  type: "shape";
  shape: "rect" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

export type CaptionElement = BaseElement & {
  type: "caption";
  text: string;
  style?: "default" | "subtitle";
};

export type VideoElement = BaseElement & {
  type: "video";
  src: string;
};

export type AudioElement = BaseElement & {
  type: "audio";
  src: string;
};

export type ImageElement = BaseElement & {
  type: "image";
  src: string;
};

export type TimelineElement =
  | TextElement
  | ShapeElement
  | CaptionElement
  | VideoElement
  | AudioElement
  | ImageElement;

export type TimelineState = {
  currentTimeMs: number;
  playing: boolean;
};

export type ProjectFormat = {
  preset: string;
  width: number;
  height: number;
  fps: number;
};

export type ProjectJSON = {
  schemaVersion: 1;
  id: string;
  title: string;
  format: ProjectFormat;
  elements: TimelineElement[];
  timeline: TimelineState;
};

export type ExportVideoOptions = {
  tier: "draft" | "final";
  format?: "mp4" | "webm";
};
