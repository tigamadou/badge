import { Page, expect } from "@playwright/test";
import { loginAs } from "./auth";

// Espace de travail cible apres connexion.
export type Workspace =
  | { kind: "org"; id: string }
  | { kind: "event"; id: string }
  | { kind: "platform" };

function targetPath(ws: Workspace): string {
  return ws.kind === "platform" ? "/platform" : `/${ws.kind}/${ws.id}`;
}

function pathRegExp(path: string): RegExp {
  return new RegExp(`${path.replace(/[/]/g, "\\/")}(\\/|$)`);
}

// Connexion via le formulaire /login, puis atterrissage sur l'espace attendu en
// reproduisant le parcours reel :
//   - >= 2 espaces (ex. OWNER d'org + ADMIN d'event) : /select s'affiche et
//     l'utilisateur doit cliquer la carte de l'espace voulu ;
//   - 1 seul espace : /select redirige cote serveur, l'atterrissage est direct.
// L'URL est verifiee a chaque etape (contrat "test UI").
export async function loginAndEnter(
  page: Page,
  user: { email: string; password: string },
  ws: Workspace,
): Promise<void> {
  await loginAs(page, user);
  const target = targetPath(ws);

  // Laisse la redirection serveur s'appliquer (mono-espace) ou /select s'afficher.
  await page.waitForURL(
    (url) => url.pathname === "/select" || url.pathname.startsWith(target),
  );

  if (new URL(page.url()).pathname === "/select") {
    await expect(page).toHaveURL(/\/select$/);
    await expect(page.getByRole("heading", { name: /choisissez un espace/i })).toBeVisible();
    await page.locator(`a[href="${target}"]`).first().click();
    await page.waitForURL((url) => url.pathname.startsWith(target));
  }

  await expect(page).toHaveURL(pathRegExp(target));
}
