import { describe, expect, it } from "vitest";
import { renderDocHtml } from "../render";

describe("renderDocHtml", () => {
  it("rend titres, listes, tableaux, gras et liens", () => {
    const html = renderDocHtml("## Titre\n\n- un\n- **deux**\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n[Aide](/org/x/docs) et [site](https://exemple.fr)\n");
    expect(html).toContain("<h2>Titre</h2>");
    expect(html).toContain("<li><strong>deux</strong></li>");
    expect(html).toContain("<table>");
    expect(html).toContain('<a href="/org/x/docs">Aide</a>');
    expect(html).toContain('href="https://exemple.fr" target="_blank" rel="noopener noreferrer"');
  });

  it("échappe le HTML brut et les scripts", () => {
    const html = renderDocHtml('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("neutralise les liens javascript: et data:, garde mailto: et les liens relatifs", () => {
    const html = renderDocHtml("[x](javascript:alert(1)) [y](data:text/html;base64,AAAA) [z](JaVaScRiPt:alert(1)) [m](mailto:a@b.fr) [r](./page) [h](#ancre)");
    expect(html).not.toContain("href=\"javascript");
    expect(html).not.toMatch(/href="data:/i);
    expect(html).not.toMatch(/href="javascript/i);
    expect(html).toContain('href="mailto:a@b.fr"');
    expect(html).toContain('href="./page"');
    expect(html).toContain('href="#ancre"');
  });
});
