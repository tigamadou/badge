import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { SubscriptionForm } from "../SubscriptionForm";

const plans = [{ id: "p1", name: "Pro", period: "MONTHLY" as const }];
const current = { planId: "p1", status: "ACTIVE" as const, overrideMaxEvents: "", overrideMaxParticipantsPerEvent: "", endDate: null };

describe("SubscriptionForm", () => {
  it("sans subscriptions.update : résumé sans bouton Modifier", () => {
    const out = renderToStaticMarkup(<SubscriptionForm orgId="o1" plans={plans} current={current} />);
    expect(out).toContain("Pro");
    expect(out).not.toContain("Modifier");
    expect(out).not.toContain("<form");
  });

  it("sans droit et sans abonnement : aucun champ", () => {
    const out = renderToStaticMarkup(<SubscriptionForm orgId="o1" plans={plans} current={null} />);
    expect(out).toContain("Aucun abonnement.");
    expect(out).not.toContain("<form");
  });

  it("avec le droit : bouton Modifier sur un abonnement existant, formulaire sinon", () => {
    expect(renderToStaticMarkup(<SubscriptionForm orgId="o1" plans={plans} current={current} canEdit />)).toContain("Modifier");
    expect(renderToStaticMarkup(<SubscriptionForm orgId="o1" plans={plans} current={null} canEdit />)).toContain("<form");
  });
});
