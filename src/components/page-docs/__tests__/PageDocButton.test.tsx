import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let pathname = "/org/abc/events/new";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/content/page-docs/index.generated", async () => ({
  PAGE_DOC_INDEX: (await import("@/lib/page-docs/__tests__/fixtures")).FIXTURE_INDEX,
}));
import { PageDocButton } from "../PageDocButton";
import { PageDocPanelContent, PanelFrame } from "../PageDocPanel";
import { DocBody } from "../DocBody";

describe("PageDocButton", () => {
  it("rend le bouton « ? » quand la page courante a une doc", () => {
    pathname = "/org/abc/events/new";
    const html = renderToStaticMarkup(<PageDocButton />);
    expect(html).toContain('aria-label="Aide sur cette page"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("ne rend rien sans doc pour la page", () => {
    pathname = "/org/abc/pas-de-doc";
    expect(renderToStaticMarkup(<PageDocButton />)).toBe("");
    pathname = "/platform/organizations/xyz/inconnue";
    expect(renderToStaticMarkup(<PageDocButton />)).toBe("");
  });
});

describe("panneau", () => {
  it("affiche chargement, erreur avec « Réessayer » et la doc avec sa date et le lien", () => {
    const noop = () => undefined;
    expect(renderToStaticMarkup(<PageDocPanelContent state={{ status: "loading" }} onRetry={noop} />)).toContain("Chargement de l&#x27;aide");
    const error = renderToStaticMarkup(<PageDocPanelContent state={{ status: "error" }} onRetry={noop} />);
    expect(error).toContain("Réessayer");
    expect(error).toContain('role="alert"');
    const ready = renderToStaticMarkup(
      <PageDocPanelContent
        state={{ status: "ready", doc: { title: "T", updatedAt: "2026-11-20", html: "<p>Corps</p>", docsHref: "/org/x/docs" } }}
        onRetry={noop}
      />,
    );
    expect(ready).toContain("<p>Corps</p>");
    expect(ready).toContain("Mise à jour le 20 Novembre . 2026");
    expect(ready).toContain('href="/org/x/docs"');
    expect(ready).toContain("Toute la documentation");
  });

  it("le cadre est une boîte de dialogue modale, plein écran sous sm", () => {
    const html = renderToStaticMarkup(
      <PanelFrame title="Créer un évènement" onClose={() => undefined}>
        <DocBody html="<h2>Titre</h2>" />
      </PanelFrame>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Créer un évènement"');
    expect(html).toContain("w-full");
    expect(html).toContain("sm:max-w-md");
    expect(html).toContain('aria-label="Fermer l&#x27;aide"');
  });
});
