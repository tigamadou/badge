import type { Locator, Page } from "@playwright/test";

// Toast sonner dont le texte correspond.
export function toast(page: Page, text: string | RegExp): Locator {
  return page.locator("[data-sonner-toast]").filter({ hasText: text });
}

// Compte les requêtes émises (méthode + fragment d'URL) ; renvoie un lecteur du compteur.
export function countRequests(page: Page, method: string, urlPart: string): () => number {
  let count = 0;
  page.on("request", (req) => {
    if (req.method() === method && req.url().includes(urlPart)) count += 1;
  });
  return () => count;
}

// Simule un 500 Next/Caddy : corps HTML, pas JSON.
export async function failWith500Html(page: Page, urlGlob: string): Promise<void> {
  await page.route(urlGlob, (route) =>
    route.fulfill({ status: 500, contentType: "text/html", body: "<html><body>Internal Server Error</body></html>" }),
  );
}

// Simule une coupure réseau : fetch rejette avec TypeError.
export async function abortNetwork(page: Page, urlGlob: string): Promise<void> {
  await page.route(urlGlob, (route) => route.abort("failed"));
}
