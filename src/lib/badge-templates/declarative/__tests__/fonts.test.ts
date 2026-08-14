import { describe, it, expect, vi, beforeEach } from "vitest";

// Font.register est global au process : on l'espionne pour observer les familles
// enregistrees sans polluer l'etat reel de @react-pdf.
const register = vi.fn();
vi.mock("@react-pdf/renderer", () => ({ Font: { register: (...a: unknown[]) => register(...a) } }));

import { registerTemplateFonts, DEFAULT_FONT_FAMILY } from "../fonts";

const assets = (name: string) => `data:font/ttf;base64,${name}`;

describe("registerTemplateFonts", () => {
  beforeEach(() => register.mockClear());

  it("ne fait rien sans police declaree", () => {
    expect(registerTemplateFonts("t1", undefined, assets)).toEqual({});
    expect(register).not.toHaveBeenCalled();
  });

  it("ne fait rien sur une liste vide", () => {
    expect(registerTemplateFonts("t1", [], assets)).toEqual({});
    expect(register).not.toHaveBeenCalled();
  });

  it("prefixe la famille par l'identifiant du template", () => {
    const map = registerTemplateFonts("t1", [{ alias: "titre", file: "fonts/A.ttf" }], assets);
    expect(map).toEqual({ titre: "tpl-t1-titre" });
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ family: "tpl-t1-titre" }));
  });

  it("isole deux templates declarant le meme alias", () => {
    const a = registerTemplateFonts("t1", [{ alias: "titre", file: "fonts/A.ttf" }], assets);
    const b = registerTemplateFonts("t2", [{ alias: "titre", file: "fonts/B.ttf" }], assets);
    expect(a.titre).not.toBe(b.titre);
  });

  it("passe la data URL de la ressource comme source", () => {
    registerTemplateFonts("t1", [{ alias: "titre", file: "fonts/A.ttf", weight: 700 }], assets);
    expect(register).toHaveBeenCalledWith({
      family: "tpl-t1-titre",
      fonts: [{ src: "data:font/ttf;base64,fonts/A.ttf", fontWeight: 700, fontStyle: "normal" }],
    });
  });

  it("applique la graisse 400 par defaut", () => {
    registerTemplateFonts("t1", [{ alias: "corps", file: "fonts/B.ttf" }], assets);
    expect(register).toHaveBeenCalledWith({
      family: "tpl-t1-corps",
      fonts: [{ src: "data:font/ttf;base64,fonts/B.ttf", fontWeight: 400, fontStyle: "normal" }],
    });
  });

  it("enregistre une police avec son style italique", () => {
    registerTemplateFonts(
      "tid",
      [{ alias: "titre", file: "fonts/A.ttf", weight: 700, style: "italic" }],
      assets,
    );
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        fonts: [expect.objectContaining({ fontStyle: "italic", fontWeight: 700 })],
      }),
    );
  });

  it("expose Montserrat comme police par defaut", () => {
    expect(DEFAULT_FONT_FAMILY).toBe("Montserrat");
  });
});
