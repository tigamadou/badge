import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OnsiteOrderList } from "../OnsiteOrderList";

describe("OnsiteOrderList", () => {
  it("liste les commandes avec le lien vers le poste, sans prix", () => {
    const html = renderToStaticMarkup(
      <OnsiteOrderList
        eventId="e1"
        rows={[{ id: "r1", reference: "IMP-2026-0001", status: "IN_PRODUCTION", onsiteLocation: "Hall A" }]}
      />,
    );
    expect(html).toContain("IMP-2026-0001");
    expect(html).toContain("Hall A");
    expect(html).toContain('href="/event/e1/print/r1/onsite"');
    expect(html).not.toMatch(/FCFA|XOF|Total/);
  });

  it("aucune commande : état vide", () => {
    expect(renderToStaticMarkup(<OnsiteOrderList eventId="e1" rows={[]} />)).toContain("Aucune commande ouverte");
  });
});
