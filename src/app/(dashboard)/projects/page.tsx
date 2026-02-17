"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon } from "@/components/icons";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { ProjectCard } from "@/components/project-card";
import { useProjects } from "@/hooks/use-projects";

type SortKey = "recent" | "name";

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="h-28 w-full animate-pulse bg-muted/50" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted/50" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted/40" />
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, count, loading, error, deleteProject, duplicateProject } = useProjects();
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("recent");

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? projects.filter((p) => (p.title ?? "").toLowerCase().includes(q))
      : projects;

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "name") return (a.title ?? "").localeCompare(b.title ?? "");
      const aTs = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const bTs = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return bTs - aTs;
    });

    return sorted;
  }, [projects, query, sortKey]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <Badge variant="secondary">{loading ? "—" : count}</Badge>
        </div>
        <NewProjectDialog
          trigger={
            <Button>
              <PlusIcon className="mr-2 size-4" /> New Project
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects"
          aria-label="Search projects"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={sortKey === "recent" ? "secondary" : "outline"}
            onClick={() => setSortKey("recent")}
          >
            Last edited
          </Button>
          <Button
            size="sm"
            variant={sortKey === "name" ? "secondary" : "outline"}
            onClick={() => setSortKey("name")}
          >
            Name
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
	          <div className="font-medium">Couldn&apos;t load projects</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 p-6">
          <div className="text-base font-semibold">No projects found</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {query.trim()
              ? "Try a different search."
              : "Create a new project to start editing."}
          </div>
          <div className="mt-4">
            <NewProjectDialog
              trigger={
                <Button>
                  <PlusIcon className="mr-2 size-4" /> New Project
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDuplicate={duplicateProject}
              onDelete={async (id) => {
                if (!window.confirm("Delete this project? This cannot be undone.")) return;
                await deleteProject(id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
