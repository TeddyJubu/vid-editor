"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import {
  ChevronRightIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/cn";
import { PLANS } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "@/components/new-project-dialog";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
];

export function TopBar({
  onOpenMobileNav,
}: Readonly<{ onOpenMobileNav?: () => void }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { balance, loading: creditsLoading, subscription } = useCredits();

  const planName = subscription
    ? (PLANS.find((p) => p.id === subscription.planId)?.name ?? "Plan")
    : null;
  const showUpgrade = !creditsLoading && balance < 100;

  const breadcrumb = (() => {
    if (pathname.startsWith("/editor/")) {
      const projectId = pathname.split("/")[2] ?? "";
      return { section: "Editor", detail: projectId };
    }
    if (pathname.startsWith("/projects")) return { section: "Projects" };
    if (pathname.startsWith("/assets")) return { section: "Assets" };
    if (pathname.startsWith("/renders")) return { section: "Renders" };
    if (pathname.startsWith("/settings")) return { section: "Settings" };
    return { section: "Dashboard" };
  })();

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {onOpenMobileNav ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenMobileNav}
              className="md:hidden"
              aria-label="Open navigation"
              title="Open navigation"
            >
              <MenuIcon className="size-4" />
            </Button>
          ) : null}

          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground">
              V
            </span>
            <span>VidEditor</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
                    active && "bg-muted/40 text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <span>{breadcrumb.section}</span>
            {breadcrumb.detail ? (
              <>
                <ChevronRightIcon className="size-4" />
                <span className="max-w-48 truncate text-foreground">
                  {breadcrumb.detail}
                </span>
              </>
            ) : null}
          </div>
        </div>



          <div className="flex items-center gap-2">
          <NewProjectDialog
            trigger={
              <Button size="sm" className="hidden sm:inline-flex">
                <PlusIcon className="mr-2 size-4" /> New Project
              </Button>
            }
          />
          <NewProjectDialog
            trigger={
              <Button
                size="sm"
                className="inline-flex sm:hidden"
                aria-label="New Project"
                title="New Project"
              >
                <PlusIcon className="size-4" />
              </Button>
            }
          />

          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex"
            asChild
            href="/settings"
          >
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Credits</span>
              <span className="font-semibold">
                {creditsLoading ? "—" : `${balance} RU`}
              </span>
              {planName ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                  {planName}
                </span>
              ) : null}
            </span>
          </Button>

          {showUpgrade ? (
            <Button size="sm" className="hidden md:inline-flex" asChild href="/settings">
              Upgrade
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {resolvedTheme === "dark" ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
          </Button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-2 py-1 text-sm hover:bg-muted/50"
                aria-label="User menu"
              >
                <span className="grid size-7 place-items-center rounded-full bg-muted text-muted-foreground">
                  <UserIcon className="size-4" />
                </span>
                <span className="hidden text-muted-foreground sm:inline">
                  {user?.email ?? "Signed out"}
                </span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-50 w-64 rounded-xl border border-border bg-card p-2 shadow-lg"
              >
                <div className="px-2 py-2">
                  <div className="text-sm font-medium">Signed in as</div>
                  <div className="text-sm text-muted-foreground">
                    {user?.email ?? "—"}
                  </div>
                </div>
                <DropdownMenu.Separator className="my-2 h-px bg-border" />

                <DropdownMenu.Item asChild>
                  <Link
                    href="/settings"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/40"
                  >
                    <SettingsIcon className="size-4" />
                    Settings
                  </Link>
                </DropdownMenu.Item>

                <DropdownMenu.Item asChild>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/40"
                    onClick={async () => {
                      await signOut();
                      router.push("/sign-in");
                      router.refresh();
                    }}
                  >
                    <LogOutIcon className="size-4" />
                    Sign out
                  </button>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}
