"use client";

import * as React from "react";

export type TimelineContextValue = {
  currentTimeMs: number;
  setCurrentTimeMs: (ms: number) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
};

const TimelineContext = React.createContext<TimelineContextValue | null>(null);

export function TimelineProvider({
  value,
  children,
}: Readonly<{ value: TimelineContextValue; children: React.ReactNode }>) {
  return (
    <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>
  );
}

export function useTimelineContext(): TimelineContextValue {
  const ctx = React.useContext(TimelineContext);
  if (!ctx) {
    throw new Error("useTimelineContext must be used within a TimelineProvider");
  }
  return ctx;
}

export function Timeline({
  className,
}: Readonly<{ className?: string }>) {
  const { currentTimeMs, setCurrentTimeMs } = useTimelineContext();

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="text-xs font-medium text-white/80">Timeline</div>
        <div className="text-xs text-white/60">{(currentTimeMs / 1000).toFixed(2)}s</div>
      </div>
      <div className="p-3">
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <input
            aria-label="Timeline scrubber"
            type="range"
            min={0}
            max={60_000}
            step={33}
            value={currentTimeMs}
            onChange={(e) => setCurrentTimeMs(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-3 grid grid-cols-1 gap-2">
            <div className="h-10 rounded bg-white/5" />
            <div className="h-10 rounded bg-white/5" />
            <div className="h-10 rounded bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
