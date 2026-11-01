import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SubscriptionRightsForm } from "../SubscriptionRightsForm";
import { DEFAULT_RIGHTS, parseRights } from "@/lib/subscription-rights";

function inputs(html: string): string[] {
  return html.match(/<input[^>]*>/g) ?? [];
}

describe("SubscriptionRightsForm", () => {
  it("affiche huit cases cochées selon initial", () => {
    const initial = parseRights({ CREATE_EVENT: { inactive: true }, ACCESS_ORG_SPACE: { active: false } });
    const boxes = inputs(renderToStaticMarkup(<SubscriptionRightsForm initial={initial} canManage />));
    expect(boxes).toHaveLength(8);
    // Ordre : droit par droit, actif puis inactif.
    const checked = boxes.map((b) => /\schecked(=|\s|>)/.test(b));
    expect(checked).toEqual([true, true, true, true, true, true, false, false]);
    expect(boxes.every((b) => !/\sdisabled/.test(b))).toBe(true);
  });

  it("désactive les cases sans droit de gestion", () => {
    const boxes = inputs(renderToStaticMarkup(<SubscriptionRightsForm initial={DEFAULT_RIGHTS} canManage={false} />));
    expect(boxes).toHaveLength(8);
    expect(boxes.every((b) => /\sdisabled/.test(b))).toBe(true);
  });

  it("utilise les libellés de colonnes", () => {
    const html = renderToStaticMarkup(<SubscriptionRightsForm initial={DEFAULT_RIGHTS} canManage />);
    expect(html).toContain("Abonnement actif");
    expect(html).toContain("Abonnement inactif");
  });
});
