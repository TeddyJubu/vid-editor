"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import type { Project } from "@/lib/types/project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format-time";
import { getFormatPresetById, isFormatPresetId } from "@/lib/presets";
import { useRenderJobs } from "@/hooks/use-render-jobs";

function gradientForPreset(presetId: string): string {
  const gradients = [
    "from-indigo-500/25 to-cyan-500/25",
    "from-emerald-500/25 to-teal-500/25",
    "from-fuchsia-500/25 to-rose-500/25",
    "from-amber-500/25 to-orange-500/25",
    "from-sky-500/25 to-violet-500/25",
  ];
  let hash = 0;
  for (let i = 0; i < presetId.length; i++) hash = (hash * 31 + presetId.charCodeAt(i)) >>> 0;
  return gradients[hash % gradients.length] ?? gradients[0];
}

export function ProjectCard({
  project,
  onDelete,
  onDuplicate,
}: Readonly<{
  project: Project;
  onDelete: (id: string) => Promise<void> | void;
  onDuplicate: (id: string) => Promise<void> | void;
}>) {
  const router = useRouter();

  const presetId = project.format_preset;
  const preset = isFormatPresetId(presetId) ? getFormatPresetById(presetId) : undefined;
  const badgeLabel = preset?.aspectRatioLabel ?? "Custom";
  const updatedLabel = project.updated_at ? formatRelativeTime(project.updated_at) : "";
	const { jobs: activeRenders } = useRenderJobs({ projectId: project.id, active: true, limit: 1 });
	const hasActiveRender = activeRenders.length > 0;

  return (
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden",
        "transition-shadow hover:shadow-md",
      )}
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/editor/${project.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/editor/${project.id}`);
        }
      }}
    >
      <div
        className={cn(
          "h-28 w-full bg-gradient-to-br",
          gradientForPreset(presetId),
          "border-b border-border",
        )}
      />

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{project.title}</div>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">{badgeLabel}</Badge>
						{hasActiveRender ? (
							<Badge
								variant="outline"
								className="border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-200"
							>
								Rendering
							</Badge>
						) : null}
              {updatedLabel ? (
                <span className="text-xs text-muted-foreground">{updatedLabel}</span>
              ) : null}
            </div>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={(e) => e.stopPropagation()}
                aria-label="Project actions"
                title="Actions"
              >
				⋯
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-50 w-44 rounded-xl border border-border bg-card p-1 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu.Item
                  className="cursor-default rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted/40"
                  onSelect={() => router.push(`/editor/${project.id}`)}
                >
                  Open
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cursor-default rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted/40"
                  onSelect={() => void onDuplicate(project.id)}
                >
                  Duplicate
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  className="cursor-default rounded-lg px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-600/10"
                  onSelect={() => void onDelete(project.id)}
                >
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </Card>
  );
}
