"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { EditorSaveIndicator } from "@/components/editor/editor-save-indicator";

export function EditorTopBar({
  title,
  onTitleChange,
  formatPreset,
  onBack,
  onSave,
  onUndo,
  onRedo,
  onGenerateCaptions,
  onDraftRender,
  onFinalRender,
  canUndo,
  canRedo,
  saveStatus,
}: Readonly<{
  title: string;
  onTitleChange: (v: string) => void;
  formatPreset: string;
  onBack: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onGenerateCaptions: () => void;
  onDraftRender: () => void;
  onFinalRender: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: "saved" | "saving" | "unsaved" | "error";
}>) {
  return (
    <header className="flex h-12 items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>
	          Back
        </Button>
        <Badge variant="secondary" className="bg-white/10 text-white/80">
          {formatPreset}
        </Badge>
        <div className="w-px self-stretch bg-white/10" />
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="h-9 w-[min(26rem,60vw)] border-white/10 bg-black/20 text-white placeholder:text-white/40"
        />
      </div>

      <div className="flex items-center gap-2">
        <EditorSaveIndicator status={saveStatus} />
        <div className="w-px self-stretch bg-white/10" />
        <Button size="sm" variant="outline" onClick={onUndo} disabled={!canUndo}>
          Undo
        </Button>
        <Button size="sm" variant="outline" onClick={onRedo} disabled={!canRedo}>
          Redo
        </Button>
        <Button size="sm" variant="outline" onClick={onGenerateCaptions}>
          Captions
        </Button>
        <Button size="sm" variant="outline" onClick={onSave}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onDraftRender}>
          Draft Render
        </Button>
        <Button size="sm" variant="primary" onClick={onFinalRender}>
          Final Render
        </Button>
      </div>
    </header>
  );
}
