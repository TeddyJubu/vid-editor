"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusIcon, UploadIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { ProjectCard } from "@/components/project-card";
import { useCredits } from "@/hooks/use-credits";
import { useProjects } from "@/hooks/use-projects";
import { PLANS } from "@/lib/plans";

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

export default function DashboardPage() {
  const { projects, count, loading, error, deleteProject, duplicateProject } = useProjects();
  const { balance, loading: creditsLoading, subscription } = useCredits();

  const planName = subscription
    ? (PLANS.find((p) => p.id === subscription.planId)?.name ?? "Plan")
    : null;

  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("recent");

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? projects.filter((p) => (p.title ?? "").toLowerCase().includes(q))
      : projects;

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        return (a.title ?? "").localeCompare(b.title ?? "");
      }
      const aTs = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const bTs = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return bTs - aTs;
    });
    return sorted;
  }, [projects, query, sortKey]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your projects, assets, and renders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Projects</Badge>
          <NewProjectDialog
            trigger={
              <Button>
                <PlusIcon className="mr-2 size-4" /> New Project
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{loading ? "—" : count}</div>
            <div className="text-sm text-muted-foreground">
              Total projects
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Renders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">—</div>
            <div className="text-sm text-muted-foreground">
              Completed renders (placeholder)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Credits</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="text-3xl font-semibold">{creditsLoading ? "—" : balance}</div>
              <div className="text-sm text-muted-foreground">
                RU remaining{planName ? ` • ${planName}` : ""}
              </div>
              {!creditsLoading && balance < 100 ? (
                <div className="mt-3">
                  <Button size="sm" variant="outline" asChild href="/settings">
                    Upgrade
                  </Button>
                </div>
              ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Projects</CardTitle>
              <NewProjectDialog
                trigger={
                  <Button size="sm">
                    <PlusIcon className="mr-2 size-4" /> New Project
                  </Button>
                }
              />
            </div>
          </CardHeader>
          <CardContent>
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
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                  <div className="font-medium">Couldn&apos;t load projects</div>
                <div className="mt-1 text-muted-foreground">{error}</div>
              </div>
            ) : loading ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
                <div className="text-sm font-medium">Create your first project</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Start editing a new video project in seconds.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <NewProjectDialog
                    trigger={
                      <Button size="sm">
                        <PlusIcon className="mr-2 size-4" /> New Project
                      </Button>
                    }
                  />
                  <Button size="sm" variant="outline">
                    <UploadIcon className="mr-2 size-4" /> Upload Asset
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            Tip: Organize assets by project.
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <NewProjectDialog
                trigger={
                  <Button variant="secondary" className="justify-start">
                    <PlusIcon className="mr-2 size-4" /> New Project
                  </Button>
                }
              />
              <Button variant="secondary" className="justify-start">
                <UploadIcon className="mr-2 size-4" /> Upload Asset
              </Button>
              <Button variant="secondary" className="justify-start">
                <span className="mr-2 inline-block size-4" /> Start Render
              </Button>
              <Button
                variant="secondary"
                className="justify-start"
                asChild
                href="/settings"
              >
                Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
