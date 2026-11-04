import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormSection, Switch, Checkbox } from "../FormControls";

describe("FormControls", () => {
  it("Switch reflete l'etat via aria-checked et la couleur", () => {
    const off = renderToStaticMarkup(<Switch checked={false} onChange={() => {}} label="Inscriptions ouvertes" />);
    expect(off).toContain('aria-checked="false"');
    expect(off).toContain("bg-slate-300");
    const on = renderToStaticMarkup(<Switch checked onChange={() => {}} label="Inscriptions ouvertes" />);
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain("bg-navy");
    expect(on).not.toContain("green-");
  });

  it("Checkbox coche affiche la marque", () => {
    const on = renderToStaticMarkup(<Checkbox checked onChange={() => {}} label="J'accepte" />);
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain("J&#x27;accepte");
    expect(on).toContain("border-navy bg-navy text-white");
  });

  it("FormSection rend titre et description", () => {
    const html = renderToStaticMarkup(
      <FormSection title="Identite" description="Vos informations">
        <input />
      </FormSection>,
    );
    expect(html).toContain("Identite");
    expect(html).toContain("Vos informations");
  });
});
