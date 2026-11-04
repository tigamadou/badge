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
    // l'option selectionnee porte aria-checked=true + bordure marine sur fond mist
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("border-navy bg-mist");
    expect(html).toContain("text-navy");
    expect(html).not.toMatch(/emerald-|green-/);
  });

  it("option désactivée sur fond mist", () => {
    const html = renderToStaticMarkup(
      <RadioCards name="cat" value={null} onChange={() => {}} options={[{ value: "a", title: "A", disabled: true }]} />,
    );
    expect(html).toContain("bg-mist");
    expect(html).not.toMatch(/bg-slate-50\b/);
  });

  it("aucune selection quand value est null", () => {
    const html = renderToStaticMarkup(<RadioCards name="cat" value={null} onChange={() => {}} options={OPTS} />);
    expect(html).not.toContain('aria-checked="true"');
  });
});
