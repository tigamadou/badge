import { test, expect } from "@playwright/test";
import { cleanupE2ETestData, createTestUser, disconnectDb } from "../helpers/db";
import { loginAs } from "../helpers/auth";

// Securite de session — transverse a tous les espaces authentifies.
// Le XSS du nom vit dans public/account.spec.ts (sa page) et le rate-limit de
// /register dans public/register.spec.ts. Ne reste ici que ce qui ne depend
// d'aucune page.
// NOTE : il n'existe pas de BlockedEmail globale — le blocage est PAR EVENT
// (schema.prisma), couvert par public/event-register.spec.ts.
test.describe("Transverse — Securite de session", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("Une session effacee fait rejeter les appels API proteges", async ({ page }) => {
    const user = await createTestUser({ scope: "session-clear", verified: true });
    await loginAs(page, user);

    let res = await page.request.get("/api/account/profile");
    expect(res.status()).toBe(200);

    // On supprime les cookies (donc la session NextAuth) et on retente.
    await page.context().clearCookies();

    res = await page.request.get("/api/account/profile");
    expect(res.status()).toBe(401);
    expect((await res.json()).code).toBe("NOT_AUTHENTICATED");
  });

  test("Un cookie de session falsifie fait rejeter les appels API proteges", async ({
    page,
    context,
  }) => {
    const user = await createTestUser({ scope: "session-tampered", verified: true });
    await loginAs(page, user);

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name.includes("next-auth.session-token"));

    if (sessionCookie) {
      await context.addCookies([{ ...sessionCookie, value: "tampered-junk-value" }]);
    } else {
      await context.addCookies([
        {
          name: "next-auth.session-token",
          value: "tampered-junk-value",
          url: "http://localhost:3000",
        },
      ]);
    }

    const res = await page.request.get("/api/account/profile");
    expect(res.status()).toBe(401);
  });
});
