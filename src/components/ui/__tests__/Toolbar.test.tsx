import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Toolbar, SearchInput, ChipFilter } from "../Toolbar";

describe("Toolbar", () => {
  it("SearchInput rend le placeholder et la valeur", () => {
    const html = renderToStaticMarkup(<SearchInput value="abc" onChange={() => {}} placeholder="Rechercher" />);
    expect(html).toContain('placeholder="Rechercher"');
    expect(html).toContain('value="abc"');
  });

  it("ChipFilter rend le label et les options", () => {
    const html = renderToStaticMarkup(
      <ChipFilter
        label="Statut"
        value="all"
        onChange={() => {}}
        options={[
          { value: "all", label: "Tous" },
          { value: "pending", label: "En attente" },
        ]}
      />,
    );
    expect(html).toContain("Statut");
    expect(html).toContain("En attente");
  });

  it("Toolbar enveloppe ses enfants", () => {
    const html = renderToStaticMarkup(
      <Toolbar>
        <span>filtre</span>
      </Toolbar>,
    );
    expect(html).toContain("filtre");
  });
});
