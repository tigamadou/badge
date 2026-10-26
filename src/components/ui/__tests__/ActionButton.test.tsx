import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActionButton } from "../ActionButton";

describe("ActionButton", () => {
  it("rend le libellé, la variante et l'aria-label", () => {
    const html = renderToStaticMarkup(
      <ActionButton action={async () => 1} variant="link" className="text-rose-600" aria-label="Archiver le plan">
        Archiver
      </ActionButton>,
    );
    expect(html).toContain(">Archiver</button>");
    expect(html).toContain("hover:underline");
    expect(html).toContain("text-rose-600");
    expect(html).toContain('aria-label="Archiver le plan"');
    expect(html).not.toContain("aria-busy");
  });

  it("transmet disabled", () => {
    const html = renderToStaticMarkup(
      <ActionButton action={async () => 1} disabled>
        Retirer
      </ActionButton>,
    );
    expect(html).toContain('disabled=""');
  });
});
