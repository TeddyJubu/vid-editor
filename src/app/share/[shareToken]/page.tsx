"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast-provider";

import { useRenderOutputByShare } from "@/hooks/use-render-output";
import { copyToClipboard } from "@/lib/clipboard";
import { formatFileSize } from "@/lib/format-file-size";

export default function ShareRenderOutputPage({
  params,
}: {
  params: { shareToken: string };
}) {
  const { toast } = useToast();
  const { output, signedUrl, loading, error } = useRenderOutputByShare(params.shareToken);

  const createdLabel = (() => {
    const ts = output?.created_at ? new Date(output.created_at).getTime() : NaN;
    if (!Number.isFinite(ts)) return "—";
    return new Date(ts).toLocaleString();
  })();

  const sizeLabel = typeof output?.size_bytes === "number" ? formatFileSize(output.size_bytes) : "—";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Shared Render</h1>
          <p className="text-sm text-muted-foreground">
            This link may expire. Download to keep a copy.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const url = typeof window !== "undefined" ? window.location.href : "";
            void copyToClipboard(url).then((ok) => {
              toast({
                title: ok ? "Link copied" : "Copy failed",
                variant: ok ? "success" : "destructive",
              });
            });
          }}
        >
          Copy link
        </Button>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
      {error ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-medium">Not found</div>
          <div className="mt-1 text-sm text-muted-foreground">{error}</div>
        </div>
      ) : null}

      {output && signedUrl ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-black">
            <video className="h-auto w-full" controls src={signedUrl} />
          </div>

          <div className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Format</div>
              <div className="text-sm">{output.format || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Size</div>
              <div className="text-sm">{sizeLabel}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Created</div>
              <div className="text-sm">{createdLabel}</div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="primary">
              <a href={signedUrl} target="_blank" rel="noreferrer">
                Download
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      <footer className="pt-6 text-center text-xs text-muted-foreground">Made with VidEditor</footer>
    </div>
  );
}

