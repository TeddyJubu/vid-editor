"use client";

import { useTwickStudio } from "@/lib/twick";

export function EditorProperties() {
  const { selectedElementId } = useTwickStudio();

  return (
    <aside className="w-80 border-l border-white/10 bg-black/20">
      <div className="border-b border-white/10 px-3 py-2">
        <div className="text-xs font-medium text-white/80">Properties</div>
        <div className="mt-1 text-xs text-white/50">
          {selectedElementId ? `Selected: ${selectedElementId}` : "No selection"}
        </div>
      </div>
      <div className="p-3">
        <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-white/60">
	          Inspector stub — show editable properties here.
        </div>
      </div>
    </aside>
  );
}
