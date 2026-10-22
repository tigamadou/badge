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
    expect(html).toContain("bg-brand-navy");
    expect(html).toContain("sélectionnée(s)");
    expect(html).toContain("flex-wrap");
  });
});
