import { PricingGrid } from "@/components/payments/PricingGrid";
import { listPublicPlans, type PublicPlan } from "@/lib/public-plans";

// Plans lus en base (pages dynamiques). `plans` permet à une page qui les a déjà chargés de les passer.
export async function PricingCards({ plans }: { plans?: PublicPlan[] } = {}) {
  return <PricingGrid plans={plans ?? (await listPublicPlans())} />;
}
