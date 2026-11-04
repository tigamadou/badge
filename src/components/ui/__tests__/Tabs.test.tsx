import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Tabs, Segmented } from "../Tabs";

const TABS = [
  { value: "emails", label: "E-mails" },
  { value: "docs", label: "Documents" },
];

describe("Tabs / Segmented", () => {
  it("Tabs marque l'onglet actif via aria-selected", () => {
    const html = renderToStaticMarkup(<Tabs value="docs" onChange={() => {}} tabs={TABS} />);
    expect(html).toContain("E-mails");
    expect(html).toContain("Documents");
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("border-navy text-navy");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("shrink-0");
  });

  it("Segmented rend l'option active en blanc", () => {
    const html = renderToStaticMarkup(<Segmented value="a" onChange={() => {}} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} />);
    expect(html).toContain("bg-white");
    expect(html).toContain("bg-mist");
  });
});
