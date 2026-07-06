import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Card, CardHead, CardBody } from "../Card";

describe("Card", () => {
  it("rend titre, sous-titre, action et corps", () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardHead title="Top 5 organisations" subtitle="Par inscriptions" action={<button>Voir</button>} />
        <CardBody>contenu</CardBody>
      </Card>,
    );
    expect(html).toContain("Top 5 organisations");
    expect(html).toContain("Par inscriptions");
    expect(html).toContain("Voir");
    expect(html).toContain("contenu");
  });

  it("omet le sous-titre quand absent", () => {
    const html = renderToStaticMarkup(<CardHead title="Sans sous-titre" />);
    expect(html).toContain("Sans sous-titre");
    expect(html).not.toContain("mt-0.5");
  });
});
