import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BadgePrintActions } from "../BadgePrintActions";

const props = {
  orgId: "o1",
  eventId: "e1",
  registrationId: "1261001471042",
  approved: true,
  archived: false,
  printed: false,
  printedAt: null,
};

describe("BadgePrintActions", () => {
  it("affiche l'apercu, le telechargement et le marquage actif", () => {
    const html = renderToStaticMarkup(<BadgePrintActions {...props} />);
    expect(html).not.toContain("<iframe");
    expect(html).toContain("<page-view");
    expect(html).toContain('data-requested-src="/api/org/o1/events/e1/badges/1261001471042?format=html"');
    expect(html).toContain('href="/api/org/o1/events/e1/badges/1261001471042?download=1"');
    expect(html).toContain("Télécharger");
    expect(html).toMatch(
      /<a href="\/api\/org\/o1\/events\/e1\/badges\/1261001471042" target="_blank" rel="noopener noreferrer"[^>]*>Imprimer<\/a>/,
    );
    expect(html).toContain("Marquer imprimé");
    expect(html).toContain("Non imprimé");
    expect(html).not.toContain('disabled=""');
  });

  it("affiche la date d'impression", () => {
    const html = renderToStaticMarkup(
      <BadgePrintActions {...props} printed printedAt="2026-10-01T10:00:00.000Z" />,
    );
    expect(html).toContain("Imprimé le 1 Octobre . 2026");
  });

  it("imprime sans date connue", () => {
    const html = renderToStaticMarkup(<BadgePrintActions {...props} printed printedAt={null} />);
    expect(html).toContain(">Imprimé<");
  });

  it("desactive le marquage pour une inscription non approuvee", () => {
    const html = renderToStaticMarkup(<BadgePrintActions {...props} approved={false} />);
    expect(html).toContain('disabled=""');
    expect(html).toContain("Seules les inscriptions approuvées peuvent être marquées imprimées.");
  });

  it("desactive le marquage sur un evenement archive", () => {
    const html = renderToStaticMarkup(<BadgePrintActions {...props} archived />);
    expect(html).toContain('disabled=""');
    expect(html).toContain("Événement archivé : le marquage est désactivé.");
  });
});
