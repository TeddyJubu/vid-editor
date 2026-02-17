"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";

import {
  XIcon,
  FolderIcon,
  HomeIcon,
  ImageIcon,
  PlusIcon,
  PlayIcon,
  SettingsIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { useCredits } from "@/hooks/use-credits";
import { PLANS } from "@/lib/plans";

type SidebarItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const ITEMS: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <HomeIcon className="size-4" /> },
  { href: "/projects", label: "Projects", icon: <FolderIcon className="size-4" /> },
  { href: "/assets", label: "Assets", icon: <ImageIcon className="size-4" /> },
  { href: "/renders", label: "Renders", icon: <PlayIcon className="size-4" /> },
  { href: "/settings", label: "Settings", icon: <SettingsIcon className="size-4" /> },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileOpenChange,
}: Readonly<{
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}>) {
  const pathname = usePathname();
	const { balance, loading: creditsLoading, subscription } = useCredits();
	const planName = subscription
		? (PLANS.find((p) => p.id === subscription.planId)?.name ?? "Plan")
		: "Free";

  return (
    <>
      {/* Mobile navigation (hamburger) */}
      <Dialog.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
          <Dialog.Content className="fixed left-0 top-0 z-50 h-dvh w-80 max-w-[85vw] border-r border-border bg-background p-4 md:hidden">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold tracking-tight">Navigation</div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm" aria-label="Close navigation">
                  <XIcon className="size-4" />
                </Button>
              </Dialog.Close>
            </div>

	          <div className="mb-3">
	            <NewProjectDialog
	              trigger={
	                <Button
	                  className="w-full justify-start"
	                  onClick={() => onMobileOpenChange(false)}
	                >
	                  <PlusIcon className="mr-2 size-4" /> New Project
	                </Button>
	              }
	            />
	          </div>
            <nav className="space-y-1">
              {ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onMobileOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                      "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      active && "bg-muted/50 text-foreground",
                    )}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-14 z-30 hidden h-[calc(100dvh-3.5rem)] flex-col border-r border-border bg-background md:flex",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex-1 overflow-y-auto p-3">
	          <div className="mb-3">
	            <NewProjectDialog
	              trigger={
	                <Button
	                  size="sm"
	                  className={cn(
	                    "w-full",
	                    collapsed ? "justify-center px-0" : "justify-start",
	                  )}
	                >
	                  <PlusIcon className={cn("size-4", collapsed ? "" : "mr-2")} />
	                  <span className={cn(collapsed && "sr-only")}>New Project</span>
	                </Button>
	              }
	            />
	          </div>

          <div
            className={cn("mb-3 px-2 text-xs text-muted-foreground", collapsed && "sr-only")}
          >
            Navigation
          </div>
          <nav className="space-y-1">
            {ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                    "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    active && "bg-muted/50 text-foreground",
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-border p-3">
          <div className={cn("mb-3 rounded-lg bg-muted/40 p-3", collapsed && "p-2")}>
            <div className={cn("text-xs text-muted-foreground", collapsed && "sr-only")}>
              Credits
            </div>
		    <div className={cn("text-sm font-medium", collapsed && "sr-only")}>
		      {creditsLoading ? "—" : `${balance} RU`} remaining
		    </div>
		    <div className={cn("text-xs text-muted-foreground", collapsed && "sr-only")}>
		      {planName}
		    </div>
		    {collapsed ? (
		      <div className="text-center text-xs text-muted-foreground">
		        {creditsLoading ? "—" : String(balance)}
		      </div>
		    ) : null}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            onClick={onToggleCollapsed}
          >
            <span className={cn(collapsed && "sr-only")}>Collapse</span>
            <ChevronRightIcon
              className={cn(
                "size-4 transition-transform",
                collapsed ? "rotate-180" : "rotate-0",
              )}
            />
          </Button>
        </div>
      </aside>
    </>
  );
}
