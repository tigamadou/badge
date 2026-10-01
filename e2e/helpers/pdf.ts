import { APIResponse, expect } from "@playwright/test";

// Verifie qu'une APIResponse Playwright correspond a un PDF valide :
// status 200, content-type application/pdf, taille minimale (defaut 1000 octets).
export async function expectPdfResponse(
  response: APIResponse,
  opts: { minBytes?: number } = {},
): Promise<void> {
  const minBytes = opts.minBytes ?? 1000;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/application\/pdf/);
  const buffer = await response.body();
  expect(buffer.length).toBeGreaterThan(minBytes);
}
