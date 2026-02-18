"use client";

import { Canvas, LivePlayer } from "@/lib/twick";
import type { EditorTool } from "@/components/editor/editor-toolbar";

export function EditorCanvas({ tool }: Readonly<{ tool: EditorTool }>) {
  return (
    <section className="relative min-h-0 flex-1 overflow-hidden bg-[#121325]">
      <Canvas className="h-full w-full" activeTool={tool} />
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <LivePlayer className="flex items-center gap-2" />
      </div>
    </section>
  );
}
