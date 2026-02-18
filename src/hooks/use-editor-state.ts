"use client";

import * as React from "react";

import { createStudioConfig, type ProjectJSON } from "@/lib/twick";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export type UseEditorStateResult = {
  projectJson: ProjectJSON;
  setProjectJson: (next: ProjectJSON) => void;
  setTitle: (title: string) => void;
  dirty: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  saveNow: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

const MAX_HISTORY = 25;

export function useEditorState({
  projectId,
  initialProjectJson,
}: Readonly<{
  projectId: string;
  initialProjectJson: ProjectJSON;
}>): UseEditorStateResult {
  const studioConfig = React.useMemo(() => createStudioConfig(projectId), [projectId]);

  const [projectJson, setProjectJsonState] = React.useState<ProjectJSON>(
    initialProjectJson,
  );
  const [dirty, setDirty] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);

  const [historyInfo, setHistoryInfo] = React.useState(() => ({ index: 0, length: 1 }));

  const historyRef = React.useRef<ProjectJSON[]>([initialProjectJson]);
  const indexRef = React.useRef(0);

  const pushHistory = React.useCallback((next: ProjectJSON) => {
    const history = historyRef.current;
    const index = indexRef.current;

    const trimmed = history.slice(0, index + 1);
    trimmed.push(next);

    const capped = trimmed.slice(-MAX_HISTORY);
    const nextIndex = capped.length - 1;

    historyRef.current = capped;
    indexRef.current = nextIndex;
    setHistoryInfo({ index: nextIndex, length: capped.length });
  }, []);

  const setProjectJson = React.useCallback(
    (next: ProjectJSON) => {
      setProjectJsonState(next);
      pushHistory(next);
      setDirty(true);
      setSaveStatus("unsaved");
    },
    [pushHistory],
  );

  const setTitle = React.useCallback(
    (title: string) => {
      setProjectJson({ ...projectJson, title });
    },
    [projectJson, setProjectJson],
  );

  const canUndo = historyInfo.index > 0;
  const canRedo = historyInfo.index < historyInfo.length - 1;

  const undo = React.useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    const next = historyRef.current[indexRef.current];
    if (next) {
      setProjectJsonState(next);
      setDirty(true);
      setSaveStatus("unsaved");
      setHistoryInfo({
        index: indexRef.current,
        length: historyRef.current.length,
      });
    }
  }, []);

  const redo = React.useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    const next = historyRef.current[indexRef.current];
    if (next) {
      setProjectJsonState(next);
      setDirty(true);
      setSaveStatus("unsaved");
      setHistoryInfo({
        index: indexRef.current,
        length: historyRef.current.length,
      });
    }
  }, []);

  const saveNow = React.useCallback(async () => {
    if (!dirty) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saving");
    const res = await studioConfig.saveProject(projectJson);
    if (res) {
      setDirty(false);
      setSaveStatus("saved");
      setLastSavedAt(Date.now());
    } else {
      setSaveStatus("error");
    }
  }, [dirty, projectJson, studioConfig]);

  // Auto-save (debounced): save 30s after the last change.
  React.useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      void saveNow();
    }, 30_000);
    return () => window.clearTimeout(t);
  }, [dirty, projectJson, saveNow]);

  return {
    projectJson,
    setProjectJson,
    setTitle,
    dirty,
    saveStatus,
    lastSavedAt,
    saveNow,
    canUndo,
    canRedo,
    undo,
    redo,
  };
}
