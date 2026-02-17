import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";
import type {
  CreditBalance,
  CreditEventType,
  PlanId,
  SubscriptionInfo,
} from "@/lib/types/credit";

type CreditLedgerRow = Database["public"]["Tables"]["credit_ledgers"]["Row"];
type CreditEventRow = Database["public"]["Tables"]["credit_events"]["Row"];
type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

function toIntAmount(v: number): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return 0;
  return n;
}

function planIdFromStripePriceId(stripePriceId: string): PlanId {
  const plan = PLANS.find((p) => p.stripePriceId === stripePriceId);
  return (plan?.id ?? "starter") as PlanId;
}

export async function getOrCreateLedger(workspaceId: string): Promise<CreditLedgerRow> {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("credit_ledgers")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing as unknown as CreditLedgerRow;

  const { data: created, error: createError } = await supabase
    .from("credit_ledgers")
    .insert({ workspace_id: workspaceId, balance_ru: 0 })
    .select("*")
    .single();

  if (createError) throw new Error(createError.message);
  return created as unknown as CreditLedgerRow;
}

export async function getBalance(workspaceId: string): Promise<CreditBalance> {
  const ledger = await getOrCreateLedger(workspaceId);
  return {
    balanceRu: toIntAmount(ledger.balance_ru),
    updatedAt: ledger.updated_at,
  };
}

export async function listCreditEvents(
  workspaceId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{ events: CreditEventRow[]; total: number }> {
  const supabase = await createClient();
  const ledger = await getOrCreateLedger(workspaceId);
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const { data, error, count } = await supabase
    .from("credit_events")
    .select("*", { count: "exact" })
    .eq("credit_ledger_id", ledger.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return {
    events: ((data ?? []) as unknown as CreditEventRow[]) ?? [],
    total: typeof count === "number" ? count : 0,
  };
}

async function hasMatchingEvent(params: {
  ledgerId: string;
  type: CreditEventType;
  deltaRu: number;
  renderJobId?: string | null;
}): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase
    .from("credit_events")
    .select("id")
    .eq("credit_ledger_id", params.ledgerId)
    .eq("type", params.type)
    .eq("delta_ru", params.deltaRu)
    .limit(1);

  if (params.renderJobId) {
    query = query.eq("render_job_id", params.renderJobId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

async function updateLedgerBalanceWithRetry(
  ledgerId: string,
  deltaRu: number,
): Promise<CreditLedgerRow> {
  // NOTE: Supabase JS does not expose multi-statement transactions here.
  // This is a best-effort optimistic concurrency loop.
  const supabase = await createClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: ledger, error: getErr } = await supabase
      .from("credit_ledgers")
      .select("*")
      .eq("id", ledgerId)
      .maybeSingle();

    if (getErr) throw new Error(getErr.message);
    if (!ledger) throw new Error("Credit ledger not found");

    const current = toIntAmount((ledger as { balance_ru: number }).balance_ru);
    const updatedAt = (ledger as { updated_at: string }).updated_at;
    const next = current + deltaRu;

    const { data: updated, error: updErr } = await supabase
      .from("credit_ledgers")
      .update({ balance_ru: next })
      .eq("id", ledgerId)
      .eq("updated_at", updatedAt)
      .select("*")
      .maybeSingle();

    if (updErr) throw new Error(updErr.message);
    if (updated) return updated as unknown as CreditLedgerRow;
  }

  throw new Error("Failed to update credit balance due to concurrent updates");
}

async function insertEvent(params: {
  ledgerId: string;
  type: CreditEventType;
  deltaRu: number;
  renderJobId?: string | null;
  description?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("credit_events").insert({
    credit_ledger_id: params.ledgerId,
    type: params.type,
    delta_ru: params.deltaRu,
    render_job_id: params.renderJobId ?? null,
    description: params.description ?? null,
  });
  if (error) throw new Error(error.message);
}

async function applyDelta(params: {
  workspaceId: string;
  type: CreditEventType;
  deltaRu: number;
  renderJobId?: string | null;
  description?: string | null;
}): Promise<CreditLedgerRow> {
  const ledger = await getOrCreateLedger(params.workspaceId);
  const deltaRu = toIntAmount(params.deltaRu);

  if (deltaRu === 0) return ledger;

  // Basic idempotency for render-linked events.
  if (params.renderJobId) {
    const exists = await hasMatchingEvent({
      ledgerId: ledger.id,
      type: params.type,
      deltaRu,
      renderJobId: params.renderJobId,
    });
    if (exists) return ledger;
  }

  const updated = await updateLedgerBalanceWithRetry(ledger.id, deltaRu);

  try {
    await insertEvent({
      ledgerId: ledger.id,
      type: params.type,
      deltaRu,
      renderJobId: params.renderJobId,
      description: params.description,
    });
  } catch (err) {
    // Best-effort compensation if the event insert fails after updating the ledger.
    try {
      await updateLedgerBalanceWithRetry(ledger.id, -deltaRu);
    } catch {
      // swallow; we'll surface the original error.
    }
    throw err;
  }

  return updated;
}

export async function debitCredits(
  workspaceId: string,
  amountRu: number,
  renderJobId?: string,
  description?: string,
): Promise<CreditLedgerRow> {
  const amt = Math.max(0, toIntAmount(amountRu));
  return await applyDelta({
    workspaceId,
    type: "render_debit",
    deltaRu: -amt,
    renderJobId: renderJobId ?? null,
    description: description ?? null,
  });
}

export async function creditAmount(
  workspaceId: string,
  amountRu: number,
  type: CreditEventType,
  options?: { renderJobId?: string | null; description?: string | null },
): Promise<CreditLedgerRow> {
  const amt = Math.max(0, toIntAmount(amountRu));
  return await applyDelta({
    workspaceId,
    type,
    deltaRu: amt,
    renderJobId: options?.renderJobId ?? null,
    description: options?.description ?? null,
  });
}

export async function hasEnoughCredits(workspaceId: string, amountRu: number): Promise<boolean> {
  const balance = await getBalance(workspaceId);
  return balance.balanceRu >= Math.max(0, toIntAmount(amountRu));
}

export async function getSubscription(workspaceId: string): Promise<SubscriptionInfo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as SubscriptionRow;
  return {
    id: row.id,
    planId: planIdFromStripePriceId(row.stripe_price_id),
    status: row.status,
    currentPeriodEnd: row.current_period_end,
  };
}

export async function upsertSubscription(params: {
  workspaceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}): Promise<SubscriptionRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        workspace_id: params.workspaceId,
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        stripe_price_id: params.stripePriceId,
        status: params.status,
        current_period_start: params.currentPeriodStart ?? null,
        current_period_end: params.currentPeriodEnd ?? null,
      },
      { onConflict: "workspace_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as SubscriptionRow;
}
