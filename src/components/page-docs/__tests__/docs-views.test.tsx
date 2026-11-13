import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DocsIndex } from "../DocsIndex";
import { DocArticle } from "../DocArticle";

const ITEM = { id: "org/events/new", slug: "events/new", section: "events", title: "Créer un évènement", summary: "Créez un évènement.", updatedAt: "2026-11-20" };

describe("DocsIndex", () => {
  it("liste les docs groupées par section avec des liens vers la lecture", () => {
    const html = renderToStaticMarkup(
      <DocsIndex
        space="org"
        baseHref="/org/o1/docs"
        items={[ITEM, { ...ITEM, id: "org/index", slug: "index", section: "Accueil", title: "Accueil", summary: "" }]}
      />,
    );
    expect(html).toContain(">Documentation<");
    expect(html).toContain('href="/org/o1/docs/events/new"');
    expect(html).toContain("Créer un évènement");
    expect(html).toContain("Créez un évènement.");
    expect(html).toContain("Events");
    expect(html).toContain("Accueil");
  });

  it("état vide pour un profil sans doc", () => {
    const html = renderToStaticMarkup(<DocsIndex space="platform" baseHref="/platform/docs" items={[]} />);
    expect(html).toContain("Aucune documentation disponible pour votre profil");
  });
});

describe("DocArticle", () => {
  it("affiche le titre, la date, le corps et le retour à la liste", () => {
    const html = renderToStaticMarkup(
      <DocArticle
        doc={{ id: "org/index", title: "Accueil", updatedAt: "2026-11-20", audience: "organisateur", html: "<p>Corps</p>", docsHref: "/org/o1/docs" }}
        listHref="/org/o1/docs"
      />,
    );
    expect(html).toContain("<h1");
    expect(html).toContain("Accueil");
    expect(html).toContain("Mise à jour le 20 Novembre . 2026");
    expect(html).toContain("<p>Corps</p>");
    expect(html).toContain('href="/org/o1/docs"');
  });
});
