import type { Plan } from "@/lib/types/credit";

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 19,
    creditsRu: 500,
    stripePriceId: "price_starter_placeholder",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 49,
    creditsRu: 2000,
    stripePriceId: "price_pro_placeholder",
  },
  {
    id: "team",
    name: "Team",
    priceMonthly: 199,
    creditsRu: 10000,
    stripePriceId: "price_team_placeholder",
  },
];

export const OVERAGE_RATE_PER_RU = 0.03;
