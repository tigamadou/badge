// Point d'entree du worker d'emails : cablage seul, la logique vit dans src/lib/jobs/.
import os from "node:os";
import { prisma } from "@/lib/prisma";
import { readWorkerConfig } from "@/lib/jobs/config";
import { createWorkerLoop } from "@/lib/jobs/worker-loop";

const workerId = `${os.hostname()}:${process.pid}`;
const config = readWorkerConfig(process.env);
const log = (message: string, meta?: Record<string, unknown>) => console.log(message, meta ?? "");
const loop = createWorkerLoop({ workerId, config, log });

async function shutdown() {
  await loop.stop();
  await prisma.$disconnect();
  process.exit(0);
}

async function main() {
  log("[worker] started", { workerId, ...config });
  if (process.argv.includes("--once")) {
    await loop.runOnce();
    await shutdown();
    return;
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  await loop.start();
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
