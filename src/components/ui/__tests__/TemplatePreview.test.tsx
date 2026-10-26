import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplatePreview } from "../TemplatePreview";

describe("TemplatePreview", () => {
  it("rend une image pour une source .png", () => {
    const html = renderToStaticMarkup(<TemplatePreview src="/api/files/a/proof.png" label="X" />);
    expect(html).toContain("<img");
    expect(html).toContain('alt="Aperçu X"');
  });

  it.each(["", "/api/files/a/proof.pdf"])("rend le repere d'indisponibilite pour %j", (src) => {
    const html = renderToStaticMarkup(<TemplatePreview src={src} label="X" />);
    expect(html).toContain("Aperçu indisponible");
    expect(html).not.toContain("<object");
    expect(html).not.toContain("<img");
  });
});
