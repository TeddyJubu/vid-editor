export default function EditorProjectLoading() {
  return (
    <div className="h-dvh w-dvw bg-[#0f1020] p-4 text-white">
      <div className="h-12 w-full animate-pulse rounded-md bg-white/5" />
      <div className="mt-4 flex h-[calc(100dvh-4rem)] gap-3">
        <div className="w-14 animate-pulse rounded-md bg-white/5" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1 animate-pulse rounded-md bg-white/5" />
          <div className="h-44 animate-pulse rounded-md bg-white/5" />
        </div>
        <div className="w-80 animate-pulse rounded-md bg-white/5" />
      </div>
    </div>
  );
}
