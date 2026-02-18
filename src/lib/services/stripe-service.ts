import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/types/credit";
import { creditAmount, upsertSubscription } from "@/lib/services/credit-service";

function safeParseJson(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function getString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function getPlanStripePriceId(planId: PlanId): string {
  const plan = PLANS.find((p) => p.id === planId);
  return plan?.stripePriceId ?? "price_unknown_placeholder";
}

export async function createCheckoutSession(
  _workspaceId: string,
  _planId: PlanId,
  _successUrl: string,
  _cancelUrl: string,
): Promise<{ url: string }> {
  void _workspaceId;
  void _planId;
  void _successUrl;
  void _cancelUrl;
  // TODO: Replace with real Stripe SDK calls
  return { url: "/api/billing/checkout/success?session_id=mock_session_123" };
}

export async function createPortalSession(
  _workspaceId: string,
  _returnUrl: string,
): Promise<{ url: string }> {
  void _workspaceId;
  void _returnUrl;
  // TODO: Replace with real Stripe SDK calls
  return { url: "/api/billing/portal/mock" };
}

export async function handleWebhookEvent(payload: string, signature: string | null): Promise<void> {
  void signature;
  // TODO: Replace with real Stripe signature validation
  const parsed = safeParseJson(payload);
  if (!parsed || typeof parsed !== "object") return;

  const type = getString(parsed, "type") ?? "";
  if (!type) return;

  if (type === "checkout.session.completed") {
    await handleCheckoutCompleted(parsed);
    return;
  }
  if (type === "invoice.paid") {
    await handleInvoicePaid(parsed);
    return;
  }
  if (type === "customer.subscription.updated") {
    await handleSubscriptionUpdated(parsed);
    return;
  }
  if (type === "customer.subscription.deleted") {
    await handleSubscriptionDeleted(parsed);
    return;
  }
}

async function handleCheckoutCompleted(event: unknown): Promise<void> {
  // TODO: Replace with real Stripe SDK calls
  const dataObj = (event as { data?: { object?: unknown } } | null)?.data?.object ?? null;
  const workspaceId = getString(dataObj, "workspace_id") ?? getString(dataObj, "workspaceId");
  const planIdRaw = getString(dataObj, "plan_id") ?? getString(dataObj, "planId");

  if (!workspaceId || !planIdRaw) return;

  const planId = (planIdRaw as PlanId) ?? "starter";
  await upsertSubscription({
    workspaceId,
    stripeCustomerId: getString(dataObj, "stripe_customer_id") ?? "cus_mock_123",
    stripeSubscriptionId: getString(dataObj, "stripe_subscription_id") ?? "sub_mock_123",
    stripePriceId: getPlanStripePriceId(planId),
    status: getString(dataObj, "status") ?? "active",
    currentPeriodStart: getString(dataObj, "current_period_start"),
    currentPeriodEnd: getString(dataObj, "current_period_end"),
  });
}

async function handleInvoicePaid(event: unknown): Promise<void> {
  // TODO: Replace with real Stripe SDK calls
  const dataObj = (event as { data?: { object?: unknown } } | null)?.data?.object ?? null;
  const workspaceId = getString(dataObj, "workspace_id") ?? getString(dataObj, "workspaceId");
  if (!workspaceId) return;

  const stripePriceId =
    getString(dataObj, "stripe_price_id") ??
    getString(dataObj, "price_id") ??
    getString(dataObj, "stripePriceId");

  const plan = stripePriceId ? PLANS.find((p) => p.stripePriceId === stripePriceId) : null;
  const credits = plan?.creditsRu ?? 0;
  if (credits <= 0) return;

  await creditAmount(workspaceId, credits, "subscription_grant", {
    description: `Monthly credits for ${plan?.name ?? "plan"}`,
  });
}

async function handleSubscriptionUpdated(event: unknown): Promise<void> {
  // TODO: Replace with real Stripe SDK calls
  const dataObj = (event as { data?: { object?: unknown } } | null)?.data?.object ?? null;
  const workspaceId = getString(dataObj, "workspace_id") ?? getString(dataObj, "workspaceId");
  if (!workspaceId) return;

  await upsertSubscription({
    workspaceId,
    stripeCustomerId: getString(dataObj, "stripe_customer_id") ?? "cus_mock_123",
    stripeSubscriptionId: getString(dataObj, "stripe_subscription_id") ?? "sub_mock_123",
    stripePriceId: getString(dataObj, "stripe_price_id") ?? "price_unknown_placeholder",
    status: getString(dataObj, "status") ?? "active",
    currentPeriodStart: getString(dataObj, "current_period_start"),
    currentPeriodEnd: getString(dataObj, "current_period_end"),
  });
}

async function handleSubscriptionDeleted(event: unknown): Promise<void> {
  // TODO: Replace with real Stripe SDK calls
  const dataObj = (event as { data?: { object?: unknown } } | null)?.data?.object ?? null;
  const workspaceId = getString(dataObj, "workspace_id") ?? getString(dataObj, "workspaceId");
  if (!workspaceId) return;

  await upsertSubscription({
    workspaceId,
    stripeCustomerId: getString(dataObj, "stripe_customer_id") ?? "cus_mock_123",
    stripeSubscriptionId: getString(dataObj, "stripe_subscription_id") ?? "sub_mock_123",
    stripePriceId: getString(dataObj, "stripe_price_id") ?? "price_unknown_placeholder",
    status: "canceled",
    currentPeriodStart: getString(dataObj, "current_period_start"),
    currentPeriodEnd: getString(dataObj, "current_period_end"),
  });
}
