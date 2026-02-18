"use client";

export function EditorSaveIndicator({
  status,
}: Readonly<{ status: "saved" | "saving" | "unsaved" | "error" }>) {
  const label =
    status === "saved"
      ? "Saved"
      : status === "saving"
        ? "Saving…"
        : status === "unsaved"
          ? "Unsaved changes"
          : "Save failed";

  const dot =
    status === "saved"
      ? "bg-emerald-400"
      : status === "saving"
        ? "bg-sky-400"
        : status === "unsaved"
          ? "bg-amber-400"
          : "bg-rose-400";

  return (
    <div className="flex items-center gap-2 text-xs text-white/70">
      <span className={`inline-block size-2 rounded-full ${dot}`} />
      <span>{label}</span>
    </div>
  );
}
