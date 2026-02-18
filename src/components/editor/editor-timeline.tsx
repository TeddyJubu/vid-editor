"use client";

import { Timeline } from "@/lib/twick";

export function EditorTimeline({
  collapsed,
  onToggle,
}: Readonly<{ collapsed: boolean; onToggle: () => void }>) {
  return (
    <section
      className={
        collapsed
          ? "h-10 border-t border-white/10 bg-black/20"
          : "h-56 border-t border-white/10 bg-black/20"
      }
    >
      <div className="flex h-10 items-center justify-between px-3">
        <div className="text-xs font-medium text-white/80">Timeline</div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      {!collapsed ? <Timeline className="h-[calc(100%-2.5rem)]" /> : null}
    </section>
  );
}
