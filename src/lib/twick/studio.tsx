"use client";

import * as React from "react";

import type { ProjectJSON } from "@/lib/twick/types";
import { TimelineProvider } from "@/lib/twick/timeline";
import { PlayerProvider } from "@/lib/twick/player";

export type TwickStudioProps = {
  projectJson: ProjectJSON;
  onProjectJsonChange: (next: ProjectJSON) => void;
  children: React.ReactNode;
};

export type TwickStudioContextValue = {
  projectJson: ProjectJSON;
  setProjectJson: (next: ProjectJSON) => void;
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;
};

const TwickStudioContext = React.createContext<TwickStudioContextValue | null>(
  null,
);

export function useTwickStudio(): TwickStudioContextValue {
  const ctx = React.useContext(TwickStudioContext);
  if (!ctx) {
    throw new Error("useTwickStudio must be used within <TwickStudio>");
  }
  return ctx;
}

export function TwickStudio({
  projectJson,
  onProjectJsonChange,
  children,
}: Readonly<TwickStudioProps>) {
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(
    null,
  );

  const setProjectJson = React.useCallback(
    (next: ProjectJSON) => onProjectJsonChange(next),
    [onProjectJsonChange],
  );

  const timelineValue = React.useMemo(
    () => ({
      currentTimeMs: projectJson.timeline.currentTimeMs,
      playing: projectJson.timeline.playing,
      setCurrentTimeMs: (ms: number) =>
        setProjectJson({
          ...projectJson,
          timeline: { ...projectJson.timeline, currentTimeMs: ms },
        }),
      setPlaying: (v: boolean) =>
        setProjectJson({
          ...projectJson,
          timeline: { ...projectJson.timeline, playing: v },
        }),
    }),
    [projectJson, setProjectJson],
  );

  const playerValue = React.useMemo(
    () => ({
      playing: projectJson.timeline.playing,
      setPlaying: (v: boolean) =>
        setProjectJson({
          ...projectJson,
          timeline: { ...projectJson.timeline, playing: v },
        }),
      currentTimeMs: projectJson.timeline.currentTimeMs,
    }),
    [projectJson, setProjectJson],
  );

  const studioValue = React.useMemo<TwickStudioContextValue>(
    () => ({ projectJson, setProjectJson, selectedElementId, setSelectedElementId }),
    [projectJson, setProjectJson, selectedElementId],
  );

  return (
    <TwickStudioContext.Provider value={studioValue}>
      <TimelineProvider value={timelineValue}>
        <PlayerProvider value={playerValue}>{children}</PlayerProvider>
      </TimelineProvider>
    </TwickStudioContext.Provider>
  );
}
