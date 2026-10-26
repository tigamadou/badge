import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Modal, ModalPanel } from "../Modal";

describe("Modal", () => {
  it("ne rend rien lorsqu'elle est fermée", () => {
    const html = renderToStaticMarkup(
      <Modal open={false} title="Titre" onConfirm={() => {}} onCancel={() => {}}>
        Corps
      </Modal>,
    );
    expect(html).toBe("");
  });

  it("ne plante pas au rendu serveur (pas de document) même ouverte", () => {
    expect(() =>
      renderToStaticMarkup(
        <Modal open title="Titre" onConfirm={() => {}} onCancel={() => {}}>
          Corps
        </Modal>,
      ),
    ).not.toThrow();
  });

  it("ModalPanel expose le rôle dialog, le titre et les deux boutons", () => {
    const html = renderToStaticMarkup(
      <ModalPanel title="Se déconnecter" onConfirm={() => {}} onCancel={() => {}} confirmLabel="Oui">
        Corps
      </ModalPanel>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Se déconnecter"');
    expect(html).toContain("Annuler");
    expect(html).toContain("Oui");
    expect(html).toContain("flex-wrap");
    expect(html).toContain("max-h-[70vh]");
  });

  it("confirmLoading désactive le bouton de confirmation et pose aria-busy", () => {
    const html = renderToStaticMarkup(
      <ModalPanel title="T" onConfirm={() => {}} onCancel={() => {}} confirmLabel="Oui" confirmLoading>
        Corps
      </ModalPanel>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/disabled=""/g)).toHaveLength(1);
  });
});
