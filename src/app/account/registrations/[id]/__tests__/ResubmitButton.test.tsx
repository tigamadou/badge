import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import ResubmitButton from "../ResubmitButton";

const categories = [
  { id: "c1", name: "Visiteur", color: "#111111" },
  { id: "c2", name: "Exposant", color: "#222222" },
  { id: "c3", name: "Presse", color: "#333333" },
];

function render() {
  return renderToStaticMarkup(
    <ResubmitButton registrationId="REG-1" currentCategoryId="c2" categories={categories} />,
  );
}

describe("ResubmitButton", () => {
  it("renders one radio per category with the current one checked", () => {
    const html = render();
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    const checked = html.split("<button").find((b) => b.includes('aria-checked="true"'));
    expect(checked).toContain("Exposant");
    for (const c of categories) expect(html).toContain(c.name);
  });

  it("shows no help text while the current category is selected", () => {
    expect(render()).not.toContain("sera resoumise dans la catégorie");
  });

  it("keeps the resubmit label", () => {
    expect(render()).toContain("Resoumettre mon inscription");
  });
});
