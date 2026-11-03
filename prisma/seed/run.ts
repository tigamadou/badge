import { assertDemoSeedAllowed } from "../../src/lib/badge-env";
import { seedSuperAdmin } from "../../src/lib/seed-super-admin";
import { runMinimalSeed } from "./minimal";
import { runDemoSeed } from "./demo";

export async function runSeed(mode: string, env: Record<string, string | undefined> = process.env): Promise<void> {
  if (mode === "super-admin") {
    const result = await seedSuperAdmin();
    if (result.status === "created") console.log(`SUPER_ADMIN cree : ${result.email}`);
    else if (result.status === "exists") console.log("SUPER_ADMIN deja present, rien a faire");
    else console.warn(`Seed SUPER_ADMIN ignore : ${result.reason}`);
    return;
  }

  if (mode === "minimal") {
    await runMinimalSeed(env);
    console.log("Seed minimal termine. Pour le seed de demonstration : SEED_MODE=demo");
    return;
  }

  if (mode === "demo") {
    // Refus avant toute ecriture : le seed minimal reecrit deja le SMTP de la plateforme.
    assertDemoSeedAllowed(env);
    await runMinimalSeed(env);
    await runDemoSeed({ env });
    return;
  }

  throw new Error(`SEED_MODE inconnu : ${mode} (minimal | demo | super-admin)`);
}
