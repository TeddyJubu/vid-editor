"use client";

import { Button } from "@/components/ui/button";

export default function EditorError({
  error,
  reset,
}: Readonly<{ error: Error; reset: () => void }>) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 p-6">
      <h2 className="text-lg font-semibold">Editor error</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
