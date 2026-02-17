"use client";

import * as React from "react";
import * as Toast from "@radix-ui/react-toast";

type ToastVariant = "default" | "success" | "destructive";

export type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastMessage = ToastOptions & {
  id: string;
};

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback((options: ToastOptions) => {
    const msg: ToastMessage = {
      id: makeId(),
      variant: "default",
      durationMs: 4000,
      ...options,
    };

    setToasts((prev) => {
      const next = [...prev, msg];
      return next.slice(-4);
    });
  }, []);

  const value = React.useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="right">
        {children}

        {toasts.map((t) => {
          const variant = t.variant ?? "default";
          const variantClasses =
            variant === "destructive"
              ? "border-red-600/30 bg-red-600 text-white"
              : variant === "success"
                ? "border-emerald-600/30 bg-emerald-600 text-white"
                : "border-border bg-card text-foreground";

          return (
            <Toast.Root
              key={t.id}
              open
              duration={t.durationMs ?? 4000}
              onOpenChange={(open) => {
                if (!open) dismiss(t.id);
              }}
              className={
                "grid gap-1 rounded-xl border p-4 shadow-lg " +
                "data-[state=open]:animate-in data-[state=closed]:animate-out " +
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 " +
                "data-[state=closed]:slide-out-to-right-2 data-[state=open]:slide-in-from-right-2 " +
                variantClasses
              }
            >
              <Toast.Title className="text-sm font-semibold">{t.title}</Toast.Title>
              {t.description ? (
                <Toast.Description className="text-sm opacity-90">
                  {t.description}
                </Toast.Description>
              ) : null}
              <Toast.Close asChild>
                <button
                  className="absolute right-2 top-2 rounded-md p-1 opacity-70 hover:opacity-100"
                  aria-label="Close"
                  onClick={() => dismiss(t.id)}
                >
                  ×
                </button>
              </Toast.Close>
            </Toast.Root>
          );
        })}

        <Toast.Viewport className="fixed bottom-0 right-0 z-[100] flex w-[360px] max-w-[calc(100vw-1.5rem)] flex-col gap-2 p-3 outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
