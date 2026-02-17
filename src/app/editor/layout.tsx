import type { ReactNode } from "react";

export default function EditorLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Intentionally minimal: the editor has its own chrome.
  return <>{children}</>;
}
