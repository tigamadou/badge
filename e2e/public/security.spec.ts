import { test, expect } from "@playwright/test";
import {
  cleanupE2ETestData,
  createTestUser,
  getDb,
  disconnectDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";

test.describe("Public security : blocked email, XSS, session", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  test("BlockedEmail on /api/auth/register is NOT enforced (v2 limitation)", async () => {
    // En v2, BlockedEmail/BlockedDocument sont strictement *par event* (cf
    // prisma/schema.prisma : BlockedEmail.eventId est requis). La route
    // /api/auth/register ne consulte aucune table de blocage globale -- elle ne
    // gere que l'unicite de l'email. Le scenario "BlockedEmail bloque
    // /api/auth/register" n'existe pas en v2.
    //
    // Le blocage est applique cote registration event-by-event ; ce cas est
    // couvert par event-register.spec.ts (T06 "BlockedEmail blocks event
    // registration").
    test.skip(
      true,
      "v2 limitation : pas de BlockedEmail globale, seulement par event. Couvert en T06.",
    );
  });

  test("XSS in user.name is escaped on /account", async ({ page }) => {
    const xssPayload = "<script>window.__xssTriggered=true</script>Awa";
    const user = await createTestUser({ scope: "xss-name", verified: true });

    // Bypass de la validation register : on ecrit le nom XSS directement.
    await getDb().user.update({
      where: { id: user.id },
      data: { name: xssPayload },
    });

    let dialogTriggered = false;
    page.on("dialog", async (dialog) => {
      dialogTriggered = true;
      await dialog.dismiss();
    });

    await loginAs(page, user);
    await page.goto("/account");

    // Le nom doit apparaitre tel quel dans le DOM (texte) mais pas execute.
    // React echappe par defaut tout {value} string.
    const flag = await page.evaluate(() => (window as unknown as { __xssTriggered?: boolean }).__xssTriggered);
    expect(flag).toBeFalsy();
    expect(dialogTriggered).toBe(false);

    // Le texte echappe doit etre visible.
    await expect(page.getByRole("heading", { name: /bonjour/i })).toContainText(/Awa/);
  });

  test("session cookie cleared rejects calls to protected API", async ({ page }) => {
    const user = await createTestUser({ scope: "session-clear", verified: true });
    await loginAs(page, user);

    // Verif que /api/account/profile repond OK pour la session valide.
    let res = await page.request.get("/api/account/profile");
    expect(res.status()).toBe(200);

    // Clear les cookies (drop la session NextAuth) et retente.
    await page.context().clearCookies();

    res = await page.request.get("/api/account/profile");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("NOT_AUTHENTICATED");
  });

  test("tampered session cookie rejects calls to protected API", async ({ page, context }) => {
    const user = await createTestUser({ scope: "session-tampered", verified: true });
    await loginAs(page, user);

    // Recupere les cookies actuels, identifie le sessionToken NextAuth.
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.includes("next-auth.session-token"),
    );

    // Tampered : remplace la valeur par du bruit.
    if (sessionCookie) {
      await context.addCookies([
        {
          ...sessionCookie,
          value: "tampered-junk-value",
        },
      ]);
    } else {
      // Si pas de cookie NextAuth detecte, force un cookie vide.
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

  test("rate limit /api/auth/register triggers 429 (defense-in-depth)", async ({ page }) => {
    // Redondant avec auth-register.spec.ts T02 mais conserve ici pour expliciter
    // la matrice de securite. 10 req/min/IP cf src/lib/rate-limit.ts DEFAULT_MAX.
    let triggered429 = false;
    for (let i = 0; i < 12; i++) {
      const res = await page.request.post("/api/auth/register", {
        data: {
          email: `e2e-sec-rl-${i}-${Date.now()}@v2-11-e2e.test`,
          password: "Test1234!",
          name: "RateLimit",
        },
      });
      if (res.status() === 429) {
        triggered429 = true;
        break;
      }
    }
    expect(triggered429).toBe(true);
  });
});
