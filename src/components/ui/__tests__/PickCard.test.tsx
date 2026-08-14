import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OrgLogo, PickCard, PickCardDashed } from "../PickCard";

describe("PickCard / OrgLogo", () => {
  it("OrgLogo derive les initiales", () => {
    expect(renderToStaticMarkup(<OrgLogo name="Universite Forum" />)).toContain("UF");
  });

  it("PickCard est un lien vers href", () => {
    const html = renderToStaticMarkup(
      <PickCard href="/org/1" logo={<span>L</span>} title="Salon Tech" meta="3 evenements" />,
    );
    expect(html).toContain('href="/org/1"');
    expect(html).toContain("Salon Tech");
    expect(html).toContain("3 evenements");
  });

  it("PickCardDashed rend le libelle", () => {
    const html = renderToStaticMarkup(<PickCardDashed href="/platform" icon="shield" label="Mode staff" />);
    expect(html).toContain("Mode staff");
    expect(html).toContain("border-dashed");
  });
});
