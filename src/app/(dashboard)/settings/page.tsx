"use client";

import * as React from "react";

import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCredits } from "@/hooks/use-credits";
import { formatRelativeTime } from "@/lib/format-time";
import { OVERAGE_RATE_PER_RU, PLANS } from "@/lib/plans";

type ApiSuccess<T> = { data: T };
type ApiError = { error: string };

type CreditHistoryEvent = {
  id: string;
  type: string;
  delta_ru: number;
  render_job_id: string | null;
  description: string | null;
  created_at: string;
};

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

function parseHistoryEvent(v: unknown): CreditHistoryEvent | null {
  if (!v || typeof v !== "object") return null;
  const rec = v as Record<string, unknown>;

  const id = typeof rec.id === "string" ? rec.id : "";
  const type = typeof rec.type === "string" ? rec.type : "";
  const delta = typeof rec.delta_ru === "number" && Number.isFinite(rec.delta_ru) ? rec.delta_ru : NaN;
  const createdAt = typeof rec.created_at === "string" ? rec.created_at : "";
  const description = typeof rec.description === "string" ? rec.description : null;
  const renderJobId = typeof rec.render_job_id === "string" ? rec.render_job_id : null;

  if (!id || !type || !Number.isFinite(delta) || !createdAt) return null;
  return {
    id,
    type,
    delta_ru: Math.trunc(delta),
    created_at: createdAt,
    description,
    render_job_id: renderJobId,
  };
}

function formatEventType(type: string): string {
  return type
    .split("_")
    .filter(Boolean)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(" ");
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { balance, updatedAt, subscription, loading: creditsLoading, refresh: refreshCredits } =
    useCredits();

  const planName = subscription
    ? (PLANS.find((p) => p.id === subscription.planId)?.name ?? "Plan")
    : null;

  const [checkoutPlanId, setCheckoutPlanId] = React.useState<string | null>(null);
  const [portalLoading, setPortalLoading] = React.useState(false);

  const [events, setEvents] = React.useState<CreditHistoryEvent[]>([]);
  const [eventsTotal, setEventsTotal] = React.useState<number | null>(null);
  const [eventsLoading, setEventsLoading] = React.useState(true);
  const [eventsError, setEventsError] = React.useState<string | null>(null);

  const loadHistory = React.useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);

    const res = await fetch("/api/credits/history?limit=10&offset=0", { method: "GET" });
    const body = await readJsonSafe(res);

    if (!res.ok) {
      const message = isApiError(body) ? body.error : `Failed to load history (${res.status})`;
      setEventsError(message);
      setEvents([]);
      setEventsTotal(null);
      setEventsLoading(false);
      return;
    }

    const data = (body as ApiSuccess<Record<string, unknown>> | null)?.data ?? null;
    const rawEvents = (data as { events?: unknown } | null)?.events;
    const rawTotal = (data as { total?: unknown } | null)?.total;
    const nextTotal =
      typeof rawTotal === "number" && Number.isFinite(rawTotal) ? Math.trunc(rawTotal) : null;
    const nextEvents = Array.isArray(rawEvents)
      ? rawEvents.map(parseHistoryEvent).filter(Boolean)
      : [];

    setEvents(nextEvents as CreditHistoryEvent[]);
    setEventsTotal(nextTotal);
    setEventsLoading(false);
  }, []);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const startCheckout = React.useCallback(
    async (planId: string) => {
      setCheckoutPlanId(planId);

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const body = await readJsonSafe(res);

      if (!res.ok) {
        const message = isApiError(body) ? body.error : `Checkout failed (${res.status})`;
        toast({ title: "Checkout failed", description: message, variant: "destructive" });
        setCheckoutPlanId(null);
        return;
      }

      const url =
        (body as ApiSuccess<Record<string, unknown>> | null)?.data &&
        typeof (body as ApiSuccess<Record<string, unknown>>).data.url === "string"
          ? ((body as ApiSuccess<{ url: string }>).data.url as string)
          : "";

      if (!url) {
        toast({
          title: "Checkout failed",
          description: "Missing checkout URL in response.",
          variant: "destructive",
        });
        setCheckoutPlanId(null);
        return;
      }

      window.location.href = url;
    },
    [toast],
  );

  const openPortal = React.useCallback(async () => {
    setPortalLoading(true);

    const res = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const body = await readJsonSafe(res);

    if (!res.ok) {
      const message = isApiError(body) ? body.error : `Portal failed (${res.status})`;
      toast({ title: "Could not open billing", description: message, variant: "destructive" });
      setPortalLoading(false);
      return;
    }

    const url =
      (body as ApiSuccess<Record<string, unknown>> | null)?.data &&
      typeof (body as ApiSuccess<Record<string, unknown>>).data.url === "string"
        ? ((body as ApiSuccess<{ url: string }>).data.url as string)
        : "";

    if (!url) {
      toast({
        title: "Could not open billing",
        description: "Missing portal URL in response.",
        variant: "destructive",
      });
      setPortalLoading(false);
      return;
    }

    window.location.href = url;
  }, [toast]);

  const lowCredits = !creditsLoading && balance < 100;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <Badge variant="secondary">Billing</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Credits</CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              Your RU balance, subscription, and overage settings.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void refreshCredits();
                void loadHistory();
              }}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={portalLoading}
              onClick={() => void openPortal()}
            >
              Manage billing
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <div className="text-4xl font-semibold">
                  {creditsLoading ? "—" : `${balance} RU`}
                </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {subscription ? (
                  <>
                    Plan: <span className="text-foreground">{planName ?? "Plan"}</span>
                      {updatedAt ? ` • updated ${formatRelativeTime(updatedAt)}` : ""}
                  </>
                ) : (
                  <>
                    No active subscription
                      {updatedAt ? ` • updated ${formatRelativeTime(updatedAt)}` : ""}
                  </>
                )}
              </div>
            </div>

            {lowCredits ? (
              <Button size="sm" asChild href="#plans">
                Upgrade
              </Button>
            ) : null}
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            If you run out of credits, renders still go through. We record overage and bill it later at{" "}
            <span className="font-medium text-foreground">
              ${OVERAGE_RATE_PER_RU.toFixed(2)}/RU
            </span>
            .
          </div>
        </CardContent>
      </Card>

      <div id="plans" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Plans</h2>
          {subscription ? (
            <Badge variant="outline">Current: {planName ?? "Plan"}</Badge>
          ) : (
            <Badge variant="outline">No subscription</Badge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = subscription?.planId === p.id;
            const busy = checkoutPlanId === p.id;

            return (
              <Card key={p.id} className={isCurrent ? "border-brand/60" : undefined}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{p.name}</CardTitle>
                    {isCurrent ? <Badge>Current</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">${p.priceMonthly}/mo</div>
                  <div className="mt-1 text-sm text-muted-foreground">{p.creditsRu} RU included</div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button
                    size="sm"
                    variant={isCurrent ? "secondary" : "primary"}
                    disabled={isCurrent || busy || portalLoading}
                    onClick={() => void startCheckout(p.id)}
                  >
                      {isCurrent ? "Current plan" : busy ? "Starting..." : `Choose ${p.name}`}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
                Latest credit events{typeof eventsTotal === "number" ? ` • ${eventsTotal} total` : ""}.
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadHistory()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {eventsError ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <div className="font-medium">Couldn&apos;t load history</div>
              <div className="mt-1 text-muted-foreground">{eventsError}</div>
            </div>
          ) : eventsLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
          ) : events.length === 0 ? (
            <div className="text-sm text-muted-foreground">No events yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Delta</th>
                    <th className="px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const positive = e.delta_ru >= 0;
                    return (
                      <tr key={e.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-3 py-2">
                          <div className="text-foreground">
                            {new Date(e.created_at).toLocaleString()}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {formatRelativeTime(e.created_at)}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <Badge variant="outline">{formatEventType(e.type)}</Badge>
                        </td>
                        <td
                          className={
                            "whitespace-nowrap px-3 py-2 font-medium " +
                            (positive ? "text-emerald-600" : "text-red-600")
                          }
                        >
                          {positive ? "+" : ""}
                          {e.delta_ru} RU
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                            {e.description ?? (e.render_job_id ? `Render ${e.render_job_id}` : "—")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
