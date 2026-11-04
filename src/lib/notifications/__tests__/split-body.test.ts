import { describe, it, expect } from "vitest";
import { isAnchored, splitBodyByAnchors } from "../split-body";

describe("splitBodyByAnchors", () => {
  it("transforme l'ancre présente en segment lié", () => {
    expect(splitBodyByAnchors("Awa a déposé un profil.", [{ label: "x", href: "/p", anchor: "Awa" }])).toEqual([
      { text: "Awa", href: "/p" },
      { text: " a déposé un profil." },
    ]);
  });

  it("ancre au milieu et à la fin", () => {
    expect(splitBodyByAnchors("A Forum fin", [{ label: "x", href: "/e", anchor: "fin" }])).toEqual([
      { text: "A Forum " },
      { text: "fin", href: "/e" },
    ]);
  });

  it("ancre absente ou vide : corps inchangé", () => {
    expect(splitBodyByAnchors("Bonjour", [{ label: "x", href: "/p", anchor: "Awa" }, { label: "y", href: "/q" }])).toEqual([
      { text: "Bonjour" },
    ]);
  });

  it("ancre dupliquée : première occurrence seulement", () => {
    expect(splitBodyByAnchors("Forum puis Forum", [{ label: "x", href: "/e", anchor: "Forum" }])).toEqual([
      { text: "Forum", href: "/e" },
      { text: " puis Forum" },
    ]);
  });

  it("plusieurs ancres, ordre du texte, chevauchement ignoré", () => {
    const segs = splitBodyByAnchors("Awa à Forum", [
      { label: "a", href: "/e", anchor: "Forum" },
      { label: "b", href: "/p", anchor: "Awa" },
      { label: "c", href: "/z", anchor: "Awa à" },
    ]);
    expect(segs).toEqual([
      { text: "Awa", href: "/p" },
      { text: " à " },
      { text: "Forum", href: "/e" },
    ]);
  });

  it("corps vide : un segment vide", () => {
    expect(splitBodyByAnchors("", [])).toEqual([{ text: "" }]);
  });
});

describe("isAnchored", () => {
  it("vrai seulement si l'ancre existe dans le corps", () => {
    expect(isAnchored("Awa", { label: "x", href: "/", anchor: "Awa" })).toBe(true);
    expect(isAnchored("Awa", { label: "x", href: "/", anchor: "Bob" })).toBe(false);
    expect(isAnchored("Awa", { label: "x", href: "/" })).toBe(false);
    expect(isAnchored("Awa", undefined)).toBe(false);
  });
});
