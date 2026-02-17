"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";

import type { CaptionStyle } from "@/lib/types/caption";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

function statusLabel(status: string): string {
  if (status === "generating") return "Starting";
  if (status === "polling") return "Processing";
  if (status === "completed") return "Completed";
  if (status === "error") return "Failed";
  return "Idle";
}

function statusBadgeClass(status: string): string {
  if (status === "polling" || status === "generating") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-200";
  }
  if (status === "completed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "error") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }
  return "border-white/10 bg-white/5 text-white/70";
}

export function CaptionsDialog({
  open,
  onOpenChange,
  style,
  onStyleChange,
  status,
  error,
  onGenerate,
}: Readonly<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  style: CaptionStyle;
  onStyleChange: (v: CaptionStyle) => void;
  status: "idle" | "generating" | "polling" | "completed" | "error";
  error: string | null;
  onGenerate: () => void;
}>) {
  const busy = status === "generating" || status === "polling";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-white/10 bg-[#0f1115] p-5 shadow-xl text-white",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold">Generate Captions</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-white/60">
                Creates mock caption elements and adds them to the timeline.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Close
              </Button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-white/70">Status</div>
                  <div className="mt-1">
                    <Badge variant="outline" className={statusBadgeClass(status)}>
                      {statusLabel(status)}
                    </Badge>
                  </div>
                </div>
              </div>

              {status === "error" && error ? (
                <div className="mt-3 text-sm text-rose-100/90">{error}</div>
              ) : null}
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <Label className="text-xs font-medium text-white/70">Caption style</Label>
              <select
                className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
                value={style}
                disabled={busy}
                onChange={(e) => onStyleChange(e.target.value as CaptionStyle)}
              >
                <option value="word_by_word">Word-by-word</option>
                <option value="sentence">Sentence</option>
                <option value="paragraph">Paragraph</option>
              </select>
              <div className="mt-2 text-xs text-white/50">
				Word-by-word uses &quot;subtitle&quot; style; sentence/paragraph use &quot;default&quot; style.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={onGenerate} disabled={busy}>
                {busy ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
