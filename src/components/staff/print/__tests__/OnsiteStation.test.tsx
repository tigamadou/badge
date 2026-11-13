import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/event/QrCamera", () => ({ QrCamera: () => null }));

import { OnsiteStation, type OnsiteStationProps } from "../OnsiteStation";

const props: OnsiteStationProps = {
  requestId: "r1",
  reference: "CMD-1",
  orgId: "o1",
  eventId: "e1",
  eventTitle: "Salon",
  location: null,
  printerNote: null,
  initialCounter: { ordered: 10, marginPercent: 10, cap: 11, printed: 0, beyondOrder: 0, remainingToCap: 11, level: "NORMAL" },
};

describe("OnsiteStation", () => {
  it("renvoie par défaut vers la commande plateforme", () => {
    const html = renderToStaticMarkup(<OnsiteStation {...props} />);
    expect(html).toContain('href="/platform/print/orders/r1"');
  });

  it("utilise backHref quand il est fourni", () => {
    const html = renderToStaticMarkup(<OnsiteStation {...props} backHref="/event/e1/print/r1" />);
    expect(html).toContain('href="/event/e1/print/r1"');
    expect(html).not.toContain("/platform/print/orders/r1");
  });
});
