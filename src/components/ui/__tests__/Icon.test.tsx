import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Icon } from "../Icon";

// Tests de rendu en environnement node (renderToStaticMarkup) : la repo n'a pas
// de stack DOM (RTL/jsdom) et suit une politique de tests node/integration.
describe("Icon", () => {
  it("rend un svg pour un nom connu", () => {
    const html = renderToStaticMarkup(<Icon name="building-2" size={18} />);
    expect(html).toContain("<svg");
  });

  it("ne rend rien pour un nom inconnu", () => {
    // @ts-expect-error nom hors registre : verifie le garde-fou runtime
    const html = renderToStaticMarkup(<Icon name="ce-nom-nexiste-pas" size={18} />);
    expect(html).toBe("");
  });
});
