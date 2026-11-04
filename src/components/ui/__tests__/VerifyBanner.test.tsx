import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VerifyBanner, PhoneMockup } from "../VerifyBanner";

describe("VerifyBanner / PhoneMockup", () => {
  it("reflete l'etat valide/invalide", () => {
    const valid = renderToStaticMarkup(<VerifyBanner valid title="Badge valide" />);
    expect(valid).toContain("bg-turquoise");
    // Jamais de texte blanc sur turquoise : le texte est marine.
    expect(valid).toContain("text-navy");
    expect(valid).not.toContain("text-white");
    const invalid = renderToStaticMarkup(<VerifyBanner valid={false} title="Badge revoque" />);
    expect(invalid).toContain("Badge revoque");
    expect(invalid).toContain("bg-rose-600");
    expect(invalid).toContain("text-white");
  });

  it("PhoneMockup enveloppe son contenu", () => {
    const html = renderToStaticMarkup(<PhoneMockup><span>ecran</span></PhoneMockup>);
    expect(html).toContain("ecran");
    expect(html).toContain("bg-mist");
  });
});
