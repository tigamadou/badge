import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScannerFrame, ScanResult } from "../ScannerFrame";

describe("ScannerFrame / ScanResult", () => {
  it("ScannerFrame rend le cadre et enveloppe le flux", () => {
    const html = renderToStaticMarkup(
      <ScannerFrame>
        <div>flux</div>
      </ScannerFrame>,
    );
    expect(html).toContain("flux");
    expect(html).toContain("border-green-400");
  });

  it("ScanResult reflete valide / invalide", () => {
    expect(renderToStaticMarkup(<ScanResult valid title="Acces autorise" />)).toContain("Acces autorise");
    expect(renderToStaticMarkup(<ScanResult valid title="Acces autorise" />)).toContain("text-emerald-700");
    const invalid = renderToStaticMarkup(<ScanResult valid={false} title="Badge revoque" />);
    expect(invalid).toContain("Badge revoque");
    expect(invalid).toContain("bg-rose-600");
  });
});
