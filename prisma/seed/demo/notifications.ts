import type { DemoContext } from "./context";
import { loadWorld } from "./billing/world";
import { cleanupActivity } from "./notifications/activity";
import { cleanupJobs, seedJobs } from "./notifications/jobs";

export async function seedNotificationsAndActivity(ctx: DemoContext): Promise<void> {
  const world = await loadWorld();
  await seedJobs(ctx, world);
}

/** Jobs de demo (aucune cascade ne les atteint) puis journal hors impression. */
export async function cleanupNotificationsAndActivity(_ctx: DemoContext): Promise<void> {
  await cleanupJobs();
  await cleanupActivity();
}
