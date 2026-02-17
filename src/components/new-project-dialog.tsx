"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";

import { FORMAT_PRESETS, type FormatPresetId } from "@/lib/presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import { cn } from "@/lib/cn";

type CreateProjectResponse = {
  data?: {
    project?: { id: string; title: string };
    latestVersion?: { id: string } | null;
  };
  error?: string;
};

export function NewProjectDialog({
  trigger,
  defaultPresetId,
}: Readonly<{
  trigger: React.ReactNode;
  defaultPresetId?: FormatPresetId;
}>) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [presetId, setPresetId] = React.useState<FormatPresetId>(
    defaultPresetId ?? FORMAT_PRESETS[0].id,
  );
  const [loading, setLoading] = React.useState(false);

  const preset = React.useMemo(
    () => FORMAT_PRESETS.find((p) => p.id === presetId) ?? FORMAT_PRESETS[0],
    [presetId],
  );

  async function onCreate() {
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > 100) {
      toast({
        title: "Invalid title",
        description: "Title is required (1–100 characters).",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, formatPresetId: presetId }),
      });
      const body = (await res.json().catch(() => null)) as CreateProjectResponse | null;

      if (!res.ok) {
        const message = body?.error ?? `Failed to create project (${res.status})`;
        toast({ title: "Create failed", description: message, variant: "destructive" });
        setLoading(false);
        return;
      }

      const projectId = body?.data?.project?.id;
      if (!projectId) {
        toast({
          title: "Create failed",
          description: "Missing project id from server.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Project created", variant: "success" });
      setOpen(false);
      setTitle("");
      router.push(`/editor/${projectId}`);
      router.refresh();
    } catch (err) {
      toast({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setLoading(false);
        setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-border bg-card p-5 shadow-xl",
          )}
        >
          <div className="mb-4">
            <Dialog.Title className="text-base font-semibold">New Project</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              Create a new project and start editing.
            </Dialog.Description>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np-title">Title</Label>
              <Input
                id="np-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My awesome video"
                maxLength={100}
                disabled={loading}
              />
              <div className="text-xs text-muted-foreground">
                {Math.min(title.length, 100)}/100
              </div>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select.Root value={presetId} onValueChange={(v) => setPresetId(v as FormatPresetId)}>
                <Select.Trigger
                  className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
                  )}
                  disabled={loading}
                  aria-label="Select format preset"
                >
                  <Select.Value />
                  <Select.Icon className="text-muted-foreground">
                    <span className="text-xs">▾</span>
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="z-[60] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                    <Select.Viewport className="p-1">
                      {FORMAT_PRESETS.map((p) => (
                        <Select.Item
                          key={p.id}
                          value={p.id}
                          className={cn(
                            "flex cursor-default items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                            "outline-none focus:bg-muted/40",
                          )}
                        >
                          <Select.ItemText>{p.name}</Select.ItemText>
                          <span className="text-xs text-muted-foreground">
                            {p.width && p.height ? `${p.width}×${p.height}` : "—"}
                            {p.fps ? ` @ ${p.fps}fps` : ""}
                          </span>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <div className="font-medium">Preview</div>
                <div className="mt-1 text-muted-foreground">
                  {preset.width && preset.height ? (
                    <span>
                      {preset.width}×{preset.height}
                      {preset.fps ? `×${preset.fps}fps` : ""}
                    </span>
                  ) : (
                    <span>Custom dimensions</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" disabled={loading}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button onClick={() => void onCreate()} disabled={loading}>
              {loading ? "Creating…" : "Create"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
