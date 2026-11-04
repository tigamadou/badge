import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { formatFcfa } from "@/lib/print-requests/labels";
import { QuoteMessageCard } from "../QuoteMessageCard";

describe("QuoteMessageCard", () => {
  it("avec lignes : tableau complet et totaux formatés", () => {
    const html = renderToStaticMarkup(
      <QuoteMessageCard
        version={2}
        total={formatFcfa(90000)}
        rows={[]}
        lines={[{ label: "Badge PVC", quantity: 200, unitPrice: 450 }]}
      />,
    );
    expect(html).toContain("Devis v2");
    expect(html).toContain("Quantité");
    expect(html).toContain("Badge PVC");
    expect(html).toContain(formatFcfa(90000));
  });

  it("sans lignes : évolutions du récapitulatif, texte échappé", () => {
    const html = renderToStaticMarkup(
      <QuoteMessageCard version={1} total="1 FCFA" rows={["Ligne ajoutée : <script>alert(1)</script>"]} />,
    );
    expect(html).toContain("Évolution");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
