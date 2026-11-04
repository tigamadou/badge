import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Table } from "../Table";

describe("Table", () => {
  const html = renderToStaticMarkup(
    <Table
      columns={[{ key: "n", header: "Nom", render: (r: { n: string }) => r.n }]}
      data={[{ n: "Awa" }]}
      keyExtractor={(r) => r.n}
    />,
  );

  it("rend en-tête et lignes", () => {
    expect(html).toContain("Nom");
    expect(html).toContain("Awa");
  });

  it("en-tête mist et survol de ligne mist", () => {
    expect(html).toContain("bg-mist");
    expect(html).toContain("hover:bg-mist");
    expect(html).not.toMatch(/bg-slate-50\b/);
  });
});
