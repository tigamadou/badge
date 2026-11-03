import type { DemoContext } from "./context";
import { loadWorld } from "./billing/world";
import { cleanupActivity } from "./notifications/activity";
import { cleanupJobs, seedJobs } from "./notifications/jobs";
import { cleanupNotifications, seedNotifications } from "./notifications/notifications";

export async function seedNotificationsAndActivity(ctx: DemoContext): Promise<void> {
  const world = await loadWorld();
  await cleanupNotifications();
  const jobs = await seedJobs(ctx, world);
  await seedNotifications(ctx, world, jobs);
}

/** Notifications et jobs de demo (aucune cascade ne les atteint) puis journal hors impression. */
export async function cleanupNotificationsAndActivity(_ctx: DemoContext): Promise<void> {
  await cleanupNotifications();
  await cleanupJobs();
  await cleanupActivity();
}
