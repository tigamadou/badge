import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MiniChart } from "../MiniChart";

describe("MiniChart", () => {
  it("rend une barre par valeur avec un label accessible", () => {
    const html = renderToStaticMarkup(<MiniChart values={[2, 4, 8, 0]} ariaLabel="Inscriptions sur 30 jours" />);
    expect(html).toContain('aria-label="Inscriptions sur 30 jours"');
    expect(html).toContain('role="img"');
    expect((html.match(/<i /g) || []).length).toBe(4);
  });

  it("barres marine (série neutre)", () => {
    const html = renderToStaticMarkup(<MiniChart values={[1]} ariaLabel="x" />);
    expect(html).toContain("bg-navy");
    expect(html).toContain("hover:bg-navy-hover");
    expect(html).not.toContain("green-");
  });

  it("normalise sur le max (valeur max = 100%)", () => {
    const html = renderToStaticMarkup(<MiniChart values={[1, 2, 4]} ariaLabel="x" />);
    expect(html).toContain("height:100%");
  });
});
