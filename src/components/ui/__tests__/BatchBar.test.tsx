import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BatchBar, BatchButton } from "../BatchBar";

describe("BatchBar", () => {
  it("est masquee quand count vaut 0", () => {
    const html = renderToStaticMarkup(
      <BatchBar count={0}>
        <span>x</span>
      </BatchBar>,
    );
    expect(html).toBe("");
  });

  it("affiche le compteur et les actions sinon", () => {
    const html = renderToStaticMarkup(
      <BatchBar count={3}>
        <BatchButton icon="check" onClick={() => {}}>
          Approuver
        </BatchButton>
      </BatchBar>,
    );
    expect(html).toContain("3");
    expect(html).toContain("Approuver");
    expect(html).toContain("bg-navy");
    expect(html).toContain('data-surface="navy"');
    expect(html).not.toContain("brand-navy");
    expect(html).toContain("sélectionnée(s)");
    expect(html).toContain("flex-wrap");
  });

  it("BatchButton en chargement est désactivé avec un spinner", () => {
    const html = renderToStaticMarkup(
      <BatchButton loading onClick={() => {}}>
        Marquer
      </BatchButton>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("button-spinner");
  });
});
