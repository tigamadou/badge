import { describe, it, expect } from "vitest";
import * as C from "../sidebar-classes";

describe("sidebar-classes", () => {
  it("expose les 10 constantes du contrat", () => {
    expect(Object.keys(C).sort()).toEqual(
      [
        "SHELL_BANNER",
        "SIDEBAR_BRAND",
        "SIDEBAR_CONTEXT_MUTED",
        "SIDEBAR_CONTEXT_TITLE",
        "SIDEBAR_COUNT",
        "SIDEBAR_FOOTER_TEXT",
        "SIDEBAR_GROUP",
        "SIDEBAR_LINK",
        "SIDEBAR_LINK_ACTIVE",
        "SIDEBAR_ROLE_LABEL",
      ].sort(),
    );
  });

  it("garde les classes exactes du contrat", () => {
    expect(C.SIDEBAR_BRAND).toBe("mb-3 px-2 text-base font-semibold text-navy");
    expect(C.SIDEBAR_CONTEXT_TITLE).toBe("px-2 text-sm font-semibold text-navy");
    expect(C.SIDEBAR_CONTEXT_MUTED).toBe("px-2 text-xs text-nav-muted");
    expect(C.SIDEBAR_GROUP).toBe(
      "px-2.5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-nav-muted",
    );
    expect(C.SIDEBAR_LINK).toBe(
      "flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-nav-muted transition-colors hover:bg-mist hover:text-navy",
    );
    expect(C.SIDEBAR_LINK_ACTIVE).toBe(
      "flex items-center gap-2.5 rounded-lg border-l-2 border-gold bg-mist px-2.5 py-2 text-sm font-medium text-navy",
    );
    expect(C.SIDEBAR_COUNT).toBe(
      "ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-navy px-1.5 text-[11px] font-semibold leading-5 text-white",
    );
    expect(C.SIDEBAR_FOOTER_TEXT).toBe("truncate px-2 text-xs text-nav-muted");
    expect(C.SIDEBAR_ROLE_LABEL).toBe(
      "mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-nav-muted sm:hidden",
    );
    expect(C.SHELL_BANNER).toBe("bg-navy px-4 py-1.5 text-xs font-medium text-white");
  });

  it("le lien actif porte le trait or sur fond mist, texte marine", () => {
    expect(C.SIDEBAR_LINK_ACTIVE).toContain("border-gold");
    expect(C.SIDEBAR_LINK_ACTIVE).toContain("bg-mist");
    expect(C.SIDEBAR_LINK_ACTIVE).toContain("text-navy");
  });

  it("aucune classe de fond sombre ou ancienne couleur", () => {
    for (const value of Object.values(C)) {
      for (const banned of ["white/", "slate-300", "green-", "brand-navy"]) {
        expect(value).not.toContain(banned);
      }
    }
  });

  it("compteur marine/blanc et bandeau marine", () => {
    expect(C.SIDEBAR_COUNT).toContain("bg-navy");
    expect(C.SIDEBAR_COUNT).toContain("text-white");
    expect(C.SHELL_BANNER).toContain("bg-navy");
  });
});
