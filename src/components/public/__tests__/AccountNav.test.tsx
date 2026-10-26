import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let currentPath = "/account";
vi.mock("next/navigation", () => ({ usePathname: () => currentPath }));

import { AccountNav } from "../AccountNav";

function linkTag(html: string, href: string): string {
  const m = new RegExp(`<a[^>]*href="${href}"[^>]*>`).exec(html);
  return m![0];
}

describe("AccountNav", () => {
  it("ajoute l'entrée Notifications, masquée sous sm", () => {
    currentPath = "/account";
    const html = renderToStaticMarkup(<AccountNav />);
    expect(html).toContain('href="/account/notifications"');
    expect(html).toContain(">Notifications<");
    expect(linkTag(html, "/account/notifications")).toContain("hidden sm:inline-flex");
  });

  it("marque Notifications active sans activer Mes inscriptions", () => {
    currentPath = "/account/notifications";
    const html = renderToStaticMarkup(<AccountNav />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(linkTag(html, "/account/notifications")).toContain('aria-current="page"');
  });

  it("garde Mes inscriptions actif sur /account", () => {
    currentPath = "/account";
    const html = renderToStaticMarkup(<AccountNav />);
    expect(linkTag(html, "/account")).toContain('aria-current="page"');
  });
});
