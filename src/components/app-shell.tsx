"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { cn } from "@/lib/cn";

export function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh">
      <TopBar onOpenMobileNav={() => setMobileOpen(true)} />
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />
      <main className={cn("pt-14", collapsed ? "md:pl-20" : "md:pl-64")}>
        <div className="min-h-[calc(100dvh-3.5rem)]">{children}</div>
      </main>
    </div>
  );
}
