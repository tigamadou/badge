import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MiniBadge } from "../MiniBadge";

describe("MiniBadge", () => {
  it("MiniBadge reflete l'etat done", () => {
    const html = renderToStaticMarkup(
      <MiniBadge name="A. Dupont" category="Visiteur" categoryColor="#2563eb" state="done" />,
    );
    expect(html).toContain("A. Dupont");
    expect(html).toContain("bg-green-600");
  });
});
