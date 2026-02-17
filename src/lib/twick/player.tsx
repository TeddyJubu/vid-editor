"use client";

import * as React from "react";

export type PlayerContextValue = {
  playing: boolean;
  setPlaying: (v: boolean) => void;
  currentTimeMs: number;
};

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function PlayerProvider({
  value,
  children,
}: Readonly<{ value: PlayerContextValue; children: React.ReactNode }>) {
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayerContext(): PlayerContextValue {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayerContext must be used within a PlayerProvider");
  }
  return ctx;
}

export function LivePlayer({
  className,
}: Readonly<{ className?: string }>) {
  const { playing, setPlaying, currentTimeMs } = usePlayerContext();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
      >
        {playing ? "Pause" : "Play"}
      </button>
      <div className="text-xs tabular-nums text-white/60">
        {(currentTimeMs / 1000).toFixed(2)}s
      </div>
    </div>
  );
}
