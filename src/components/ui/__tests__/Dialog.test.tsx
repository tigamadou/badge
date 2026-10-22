import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Dialog, DialogPanel } from "../Dialog";

describe("Dialog", () => {
  it("ne rend rien lorsqu'il est fermé", () => {
    const html = renderToStaticMarkup(
      <Dialog open={false} title="Titre" onClose={() => {}}>
        Corps
      </Dialog>,
    );
    expect(html).toBe("");
  });

  it("ne plante pas au rendu serveur (pas de document) même ouvert", () => {
    expect(() =>
      renderToStaticMarkup(
        <Dialog open title="Titre" onClose={() => {}}>
          Corps
        </Dialog>,
      ),
    ).not.toThrow();
  });

  it("DialogPanel expose le rôle dialog, le bouton Fermer et le pied en flex-wrap", () => {
    const html = renderToStaticMarkup(
      <DialogPanel title="Détails" onClose={() => {}} footer={<span>Pied</span>}>
        Corps
      </DialogPanel>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Fermer"');
    expect(html).toContain("Pied");
    expect(html).toContain("flex-wrap");
  });
});
