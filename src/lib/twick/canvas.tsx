"use client";

import { useTwickStudio } from "@/lib/twick/studio";
import type { TextElement } from "@/lib/twick/types";

export function Canvas({
  className,
  activeTool = "select",
}: Readonly<{ className?: string; activeTool?: "select" | "text" | "shape" | "caption" }>) {
  const {
    projectJson,
    setProjectJson,
    selectedElementId,
    setSelectedElementId,
  } = useTwickStudio();

  const { width, height, fps } = projectJson.format;
  const aspectRatio =
    Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
      ? `${width} / ${height}`
      : "16 / 9";

  const firstElementId = projectJson.elements[0]?.id ?? null;

  function makeElementId() {
    return (
      globalThis.crypto?.randomUUID?.() ?? `el-${Math.random().toString(16).slice(2)}`
    );
  }

  function addTextElement() {
    const id = makeElementId();
    const next: TextElement = {
      id,
      type: "text",
      startMs: 0,
      durationMs: 5000,
      text: "New text",
      x: 96,
      y: 96,
      fontSize: 32,
      color: "#ffffff",
    };

    setProjectJson({
      ...projectJson,
      elements: [...projectJson.elements, next],
    });
    setSelectedElementId(id);
  }

  return (
    <div
      className={className}
      role="region"
      aria-label="Preview canvas"
      onClick={() => {
        if (activeTool === "text") {
          addTextElement();
          return;
        }

        setSelectedElementId(selectedElementId ? null : firstElementId);
      }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="text-xs font-medium text-white/80">Preview</div>
        <div className="text-xs text-white/60">
          {width}×{height} @ {fps}fps
        </div>
      </div>
      <div className="flex h-full items-center justify-center p-6">
        <div
          className="w-full max-w-4xl rounded-lg border border-white/10 bg-gradient-to-br from-black/40 to-black/10"
          style={{ aspectRatio }}
        >
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            {selectedElementId
              ? `Selected: ${selectedElementId}`
              : activeTool === "text"
                ? "Click to add text"
                : "Canvas stub"}
          </div>
        </div>
      </div>
    </div>
  );
}
