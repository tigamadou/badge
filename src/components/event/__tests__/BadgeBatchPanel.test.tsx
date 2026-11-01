import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BadgeBatchPanel, type BatchBadge } from "../BadgeBatchPanel";

const badge = (id: string, label = "Awa Diallo"): BatchBadge => ({
  id,
  label,
  categoryName: "Visiteur",
  categoryColor: "#4f46e5",
  printed: false,
});

const base = { orgId: "o1", eventId: "e1", archived: false, ignored: 0, selectionKey: "s1" };

describe("BadgeBatchPanel", () => {
  it("liste les badges, montre le premier et propose le ZIP", () => {
    const html = renderToStaticMarkup(
      <BadgeBatchPanel {...base} badges={[badge("111"), badge("222", "Identité masquée")]} />,
    );
    expect(html).toContain("Awa Diallo");
    expect(html).toContain("Identité masquée");
    expect(html).toContain("<page-view");
    expect(html).toContain('data-requested-src="/api/org/o1/events/e1/badges/111?format=html"');
    expect(html).toContain("Préparer le ZIP");
    expect(html).not.toContain("print-zip");
    expect(html).toContain("Marquer imprimés");
    expect(html).not.toContain('disabled=""');
  });

  it("signale les identifiants ignores", () => {
    const html = renderToStaticMarkup(<BadgeBatchPanel {...base} ignored={2} badges={[badge("111")]} />);
    expect(html).toContain("2 identifiant(s) ignoré(s) : introuvables ou non approuvés.");
  });

  it("etat vide sans ZIP ni apercu", () => {
    const html = renderToStaticMarkup(<BadgeBatchPanel {...base} badges={[]} />);
    expect(html).toContain("Aucun badge à imprimer.");
    expect(html).not.toContain("Préparer le ZIP");
    expect(html).not.toContain("<page-view");
  });

  it("aucun plafond : 5 000 badges gardent le bouton de preparation", () => {
    const many = Array.from({ length: 5000 }, (_, i) => badge(String(i)));
    const html = renderToStaticMarkup(<BadgeBatchPanel {...base} badges={many} />);
    expect(html).toContain("Préparer le ZIP");
    expect(html).not.toContain("au plus");
    expect(html).toContain("5000 badge(s)");
  });

  it("evenement archive : marquage desactive avec la raison", () => {
    const html = renderToStaticMarkup(<BadgeBatchPanel {...base} archived badges={[badge("111")]} />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Marquer imprimés/);
    expect(html).toContain("Événement archivé : le marquage est désactivé.");
  });
});
