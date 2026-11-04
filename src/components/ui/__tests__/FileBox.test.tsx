import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FileBox, Dropzone } from "../FileBox";

describe("FileBox / Dropzone", () => {
  it("FileBox affiche titre et sous-titre", () => {
    const html = renderToStaticMarkup(<FileBox icon="file" title="cni.pdf" subtitle="240 Ko" />);
    expect(html).toContain("cni.pdf");
    expect(html).toContain("240 Ko");
  });

  it("FileBox affiche l'avertissement sous le sous-titre", () => {
    const html = renderToStaticMarkup(<FileBox title="logo.png" subtitle="12 Ko" warning="À recadrer" />);
    expect(html).toContain("À recadrer");
    expect(html).toContain("text-amber-600");
  });

  it("Dropzone rend son invite", () => {
    const html = renderToStaticMarkup(
      <Dropzone onFiles={() => {}} title="Deposez un fichier" subtitle="JPEG, PNG, PDF - max 5 Mo" />,
    );
    expect(html).toContain("Deposez un fichier");
    expect(html).toContain("JPEG, PNG, PDF - max 5 Mo");
    expect(html).toContain("border-dashed");
  });
});
