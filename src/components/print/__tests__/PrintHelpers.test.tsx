import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { describeSnapshot, QuoteLinesTable } from "../QuoteLinesTable";
import { attachmentName, lineChangesOf } from "../PrintThread";
import { PrintRequestStatusBadge } from "../PrintRequestStatusBadge";

describe("describeSnapshot", () => {
  it("résume choix, texte, répartition et fichier", () => {
    expect(
      describeSnapshot([
        { optionName: "Couleur", labels: ["Bleu", "Rouge"] },
        { optionName: "Texte", text: "Bonjour" },
        { optionName: "Tailles", split: [{ label: "M", quantity: 3 }] },
        { optionName: "Logo", fileKey: "k" },
        null,
        {},
      ]),
    ).toEqual(["Couleur : Bleu, Rouge", "Texte : Bonjour", "Tailles : M × 3", "Logo : fichier joint"]);
    expect(describeSnapshot(null)).toEqual([]);
  });
});

describe("QuoteLinesTable", () => {
  it("rend un texte échappé et les montants en FCFA", () => {
    const html = renderToString(
      <QuoteLinesTable
        badgeCount={2}
        total={1500}
        lines={[
          { id: "1", label: "<script>x</script>", optionsSnapshot: null, quantity: 2, unitPrice: 750, lineTotal: 1500 },
        ]}
      />,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("FCFA");
    expect(html).toContain("Total estimé (2 badges)");
  });
});

describe("fil de discussion", () => {
  it("détaille les modifications de lignes", () => {
    const entry = {
      eventType: "LINES_CHANGED",
      details: { changes: [{ op: "REMOVED", lineId: "l", label: "Cordon" }] },
    };
    expect(lineChangesOf(entry)).toEqual(["Ligne retirée : Cordon"]);
    expect(lineChangesOf({ eventType: "SUBMITTED", details: null })).toEqual([]);
    expect(lineChangesOf({ eventType: "LINES_CHANGED", details: {} })).toEqual([]);
  });

  it("nomme la pièce jointe d'après sa clé", () => {
    expect(attachmentName("print-requests/e1/abc.pdf")).toBe("abc.pdf");
  });
});

describe("PrintRequestStatusBadge", () => {
  it("affiche le libellé français", () => {
    expect(renderToString(<PrintRequestStatusBadge status="SUBMITTED" />)).toContain("Envoyée");
  });
});
