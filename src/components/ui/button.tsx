import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/cn";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";

type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  href?: string;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-foreground hover:opacity-95 focus-visible:ring-ring",
  secondary:
    "bg-muted text-foreground hover:bg-muted/70 focus-visible:ring-ring",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-muted/40 focus-visible:ring-ring",
  ghost: "bg-transparent text-foreground hover:bg-muted/40 focus-visible:ring-ring",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      asChild,
      href,
      type,
      ...props
    },
    ref,
  ) => {
    const base = cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium",
      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:pointer-events-none disabled:opacity-50",
      VARIANT_CLASSES[variant],
      SIZE_CLASSES[size],
      className,
    );

    if (asChild && href) {
      return (
        <Link className={base} href={href}>
          {props.children}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        className={base}
        type={type ?? "button"}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
