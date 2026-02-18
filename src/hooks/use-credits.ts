"use client";

import * as React from "react";

import type { SubscriptionInfo } from "@/lib/types/credit";

type ApiSuccess<T> = { data: T };
type ApiError = { error: string };

function isApiError(v: unknown): v is ApiError {
  return Boolean(v) && typeof v === "object" && "error" in (v as Record<string, unknown>);
}

async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function parseSubscription(v: unknown): SubscriptionInfo | null {
  if (!v || typeof v !== "object") return null;
  const rec = v as Record<string, unknown>;
  const id = typeof rec.id === "string" ? rec.id : "";
  const planId = typeof rec.planId === "string" ? rec.planId : "";
  const status = typeof rec.status === "string" ? rec.status : "";
  const currentPeriodEnd = typeof rec.currentPeriodEnd === "string" ? rec.currentPeriodEnd : null;

  if (!id || !status) return null;
  if (planId !== "starter" && planId !== "pro" && planId !== "team") return null;

  return {
    id,
    planId,
    status,
    currentPeriodEnd,
  };
}

export type UseCreditsResult = {
  balance: number;
  updatedAt: string | null;
  subscription: SubscriptionInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useCredits(): UseCreditsResult {
  const [balance, setBalance] = React.useState(0);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const [subscription, setSubscription] = React.useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/credits", { method: "GET" });
    const body = await readJsonSafe(res);

    if (!res.ok) {
      const message = isApiError(body) ? body.error : `Failed to load credits (${res.status})`;
      setError(message);
      setBalance(0);
      setUpdatedAt(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    const data = (body as ApiSuccess<Record<string, unknown>> | null)?.data ?? null;
    const rawBalance = (data as { balance_ru?: unknown } | null)?.balance_ru;
    const rawUpdatedAt = (data as { updated_at?: unknown } | null)?.updated_at;
    const rawSubscription = (data as { subscription?: unknown } | null)?.subscription;

    const nextBalance =
      typeof rawBalance === "number" && Number.isFinite(rawBalance) ? Math.trunc(rawBalance) : 0;
    const nextUpdatedAt = typeof rawUpdatedAt === "string" && rawUpdatedAt ? rawUpdatedAt : null;

    setBalance(nextBalance);
    setUpdatedAt(nextUpdatedAt);
    setSubscription(parseSubscription(rawSubscription));
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  return { balance, updatedAt, subscription, loading, error, refresh };
}
