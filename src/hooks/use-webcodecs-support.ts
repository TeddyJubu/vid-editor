"use client";

import * as React from "react";

import { checkWebCodecsSupport } from "@/lib/render/browser-render";

export function useWebCodecsSupport(): { supported: boolean; checking: boolean } {
  const [supported, setSupported] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    setSupported(checkWebCodecsSupport());
    setChecking(false);
  }, []);

  return { supported, checking };
}
