import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RadioCards } from "../RadioCards";

const OPTS = [
  { value: "expo", title: "Exposant", color: "#16a34a" },
  { value: "press", title: "Presse", color: "#dc2626" },
];

describe("RadioCards", () => {
  it("marque l'option selectionnee via aria-checked", () => {
    const html = renderToStaticMarkup(<RadioCards name="cat" value="expo" onChange={() => {}} options={OPTS} />);
    expect(html).toContain("Exposant");
    expect(html).toContain("Presse");
    // l'option selectionnee porte aria-checked=true + fond emeraude
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("bg-emerald-50");
  });

  it("aucune selection quand value est null", () => {
    const html = renderToStaticMarkup(<RadioCards name="cat" value={null} onChange={() => {}} options={OPTS} />);
    expect(html).not.toContain('aria-checked="true"');
  });
});
