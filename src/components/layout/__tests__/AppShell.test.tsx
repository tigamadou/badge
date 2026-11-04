import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "../AppShell";

function render(banner?: React.ReactNode) {
  return renderToStaticMarkup(
    <AppShell sidebar={<nav>Menu</nav>} header={<span>En-tête</span>} banner={banner}>
      <p>Contenu</p>
    </AppShell>,
  );
}

describe("AppShell", () => {
  it("rend un seul aside contenant le menu", () => {
    const html = render();
    expect(html.match(/<aside/g)).toHaveLength(1);
    expect(html).toContain("<nav>Menu</nav>");
  });

  it("fournit le bouton d'ouverture masqué à partir de lg", () => {
    const html = render();
    expect(html).toContain('aria-label="Ouvrir le menu"');
    expect(html).toMatch(/<button[^>]*aria-label="Ouvrir le menu"[^>]*class="[^"]*lg:hidden/);
  });

  it("ferme le tiroir par défaut (inert + invisible)", () => {
    const html = render();
    expect(html).toMatch(/<aside[^>]*inert/);
    expect(html).toContain("-translate-x-full");
    expect(html).toContain("invisible");
    // Le voile reste dans le DOM (pour le fondu) mais transparent et non cliquable.
    expect(html).toContain("pointer-events-none opacity-0");
  });

  it("applique les classes du main et de la racine", () => {
    const html = render();
    expect(html).toMatch(/<main[^>]*class="[^"]*p-4 sm:p-6/);
    expect(html).toContain("flex h-dvh overflow-hidden");
  });

  it("le menu est clair", () => {
    const html = render();
    const aside = /<aside[^>]*class="([^"]*)"/.exec(html)![1];
    expect(aside).toContain("bg-white");
    expect(aside).toContain("border-r");
    expect(aside).toContain("border-line");
    expect(aside).not.toContain("bg-brand-navy");
    expect(aside).not.toContain("bg-navy");
    const main = /<main[^>]*class="([^"]*)"/.exec(html)![1];
    expect(main).toContain("bg-slate-100");
    expect(main).not.toContain("bg-white");
    const close = /<button[^>]*aria-label="Fermer le menu"[^>]*class="([^"]*)"/.exec(html)![1];
    expect(close).not.toContain("text-slate-300");
  });

  it("la zone de pied utilise le trait line", () => {
    const html = renderToStaticMarkup(
      <AppShell sidebar={<nav>Menu</nav>} sidebarFooter={<span>Pied</span>} header={<span>H</span>}>
        <p>Contenu</p>
      </AppShell>,
    );
    expect(html).toContain("border-t border-line");
    expect(html).not.toContain("border-white/10");
  });

  it("rend le bandeau seulement s'il est fourni", () => {
    expect(render()).not.toContain("Mode staff");
    expect(render(<div>Mode staff</div>)).toContain("Mode staff");
  });
});
