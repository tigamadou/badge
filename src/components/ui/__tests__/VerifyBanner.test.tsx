import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VerifyBanner, PhoneMockup } from "../VerifyBanner";

describe("VerifyBanner / PhoneMockup", () => {
  it("reflete l'etat valide/invalide", () => {
    expect(renderToStaticMarkup(<VerifyBanner valid title="Badge valide" />)).toContain("bg-green-600");
    const invalid = renderToStaticMarkup(<VerifyBanner valid={false} title="Badge revoque" />);
    expect(invalid).toContain("Badge revoque");
    expect(invalid).toContain("bg-rose-600");
  });

  it("PhoneMockup enveloppe son contenu", () => {
    expect(renderToStaticMarkup(<PhoneMockup><span>ecran</span></PhoneMockup>)).toContain("ecran");
  });
});
