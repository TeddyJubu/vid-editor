import * as React from "react";

import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const VARIANTS: Record<BadgeVariant, string> = {
  default: "bg-brand text-brand-foreground",
  secondary: "bg-muted text-foreground",
  outline: "border border-border bg-transparent text-foreground",
  destructive: "bg-red-600 text-white",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
