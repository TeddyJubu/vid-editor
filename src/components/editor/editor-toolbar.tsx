"use client";

const TOOLS = [
  { id: "select", label: "Select" },
  { id: "text", label: "Text" },
  { id: "shape", label: "Shape" },
  { id: "caption", label: "Caption" },
] as const;

export type EditorTool = (typeof TOOLS)[number]["id"];

export function EditorToolbar({
  tool,
  onToolChange,
	showAssets,
	onToggleAssets,
}: Readonly<{
	tool: EditorTool;
	onToolChange: (t: EditorTool) => void;
	showAssets?: boolean;
	onToggleAssets?: () => void;
}>) {
  return (
    <aside className="flex w-14 flex-col gap-2 border-r border-white/10 bg-black/20 p-2">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onToolChange(t.id)}
          className={
            tool === t.id
              ? "rounded-md border border-white/15 bg-white/10 px-2 py-2 text-xs text-white"
              : "rounded-md border border-transparent bg-transparent px-2 py-2 text-xs text-white/70 hover:bg-white/5"
          }
          title={t.label}
        >
          {t.label.slice(0, 1)}
        </button>
      ))}
			<div className="mt-2 h-px bg-white/10" />
			<button
				type="button"
				onClick={() => onToggleAssets?.()}
				className={
					showAssets
						? "rounded-md border border-white/15 bg-white/10 px-2 py-2 text-xs text-white"
						: "rounded-md border border-transparent bg-transparent px-2 py-2 text-xs text-white/70 hover:bg-white/5"
				}
				title="Assets"
			>
				As
			</button>
    </aside>
  );
}
