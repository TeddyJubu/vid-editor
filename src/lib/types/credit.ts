export type PlanId = "starter" | "pro" | "team";

export type CreditEventType =
  | "subscription_grant"
  | "render_debit"
  | "render_refund"
  | "overage_charge"
  | "manual_adjustment";

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthly: number;
  creditsRu: number;
  stripePriceId: string;
};

export type CreditBalance = {
  balanceRu: number;
  updatedAt: string;
};

export type CreditEvent = {
  id: string;
  type: CreditEventType;
  deltaRu: number;
  renderJobId: string | null;
  description: string | null;
  createdAt: string;
};

export type SubscriptionInfo = {
  id: string;
  planId: PlanId;
  status: string;
  currentPeriodEnd: string | null;
};
