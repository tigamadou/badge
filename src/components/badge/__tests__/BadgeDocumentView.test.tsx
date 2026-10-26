import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BadgeDocumentView } from "../BadgeDocumentView";

const SRC = "/api/org/o1/events/e1/badges/111?format=html";

describe("BadgeDocumentView", () => {
  it("rend page-view dans un conteneur de hauteur imposee, en chargement", () => {
    const html = renderToStaticMarkup(<BadgeDocumentView src={SRC} label="Aperçu du badge" />);
    expect(html).toContain("<page-view");
    expect(html).toContain('label="Aperçu du badge"');
    expect(html).toContain('data-testid="badge-document"');
    expect(html).toContain('data-state="loading"');
    expect(html).toContain(`data-requested-src="${SRC}"`);
    expect(html).toContain('data-src=""');
    expect(html).toContain("Chargement de l&#x27;aperçu…");
    expect(html).toContain("h-[70vh]");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<object");
  });

  it("ajoute la classe demandee", () => {
    const html = renderToStaticMarkup(<BadgeDocumentView src={SRC} label="x" className="mt-4" />);
    expect(html).toContain("mt-4");
  });
});
