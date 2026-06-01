import { Page } from "@playwright/test";
import {
  createTestStaff,
  createTestOrgMember,
  createTestEventMember,
  TestUser,
  TestStaffRole,
  TestOrgRole,
  TestEventRole,
} from "./db";

// Login via le formulaire /login. Reprend le pattern des specs existantes :
// remplir les champs, soumettre, attendre la sortie de /login.
export async function loginAs(
  page: Page,
  user: { email: string; password: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Mot de passe").fill(user.password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });
}

// Cree un staff avec le role demande, login dans la page, et retourne l'user.
export async function loginAsStaff(
  page: Page,
  opts: { role: TestStaffRole; scope: string },
): Promise<TestUser> {
  const user = await createTestStaff({ role: opts.role, scope: opts.scope });
  await loginAs(page, user);
  return user;
}

// Cree un membre org avec le role demande, login dans la page, et retourne l'user.
export async function loginAsOrgMember(
  page: Page,
  opts: { orgId: string; role: TestOrgRole; scope: string },
): Promise<TestUser> {
  const user = await createTestOrgMember({
    scope: opts.scope,
    orgId: opts.orgId,
    role: opts.role,
  });
  await loginAs(page, user);
  return user;
}

// Cree un membre event avec le role demande (et OrgMembership AUDITOR via le
// helper db.ts), login dans la page, et retourne l'user.
export async function loginAsEventMember(
  page: Page,
  opts: { orgId: string; eventId: string; role: TestEventRole; scope: string },
): Promise<TestUser> {
  const user = await createTestEventMember({
    scope: opts.scope,
    orgId: opts.orgId,
    eventId: opts.eventId,
    role: opts.role,
  });
  await loginAs(page, user);
  return user;
}
