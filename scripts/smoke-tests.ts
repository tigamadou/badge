import { PrismaClient } from "@prisma/client";

export class SmokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmokeError";
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SmokeError(message);
}

type CheckResult = { name: string; ok: boolean; detail?: string };

async function runChecks(): Promise<CheckResult[]> {
  const prisma = new PrismaClient();
  const results: CheckResult[] = [];

  const record = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({
        name,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  };

  await record("DB SELECT 1", async () => {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    assert(Array.isArray(rows) && rows.length === 1, "Pas de reponse SQL");
  });

  await record("PlatformSettings singleton", async () => {
    const ps = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    assert(ps !== null, "PlatformSettings manquant");
  });

  await record("Au moins un staff seede", async () => {
    const staff = await prisma.user.findFirst({ where: { isStaff: true } });
    assert(staff !== null, "Aucun utilisateur staff seede");
  });

  await record("Aucune organisation en base", async () => {
    const count = await prisma.organization.count();
    assert(count === 0, `Attendu 0 Organization, trouve ${count}`);
  });

  await record("Aucun event en base", async () => {
    const count = await prisma.event.count();
    assert(count === 0, `Attendu 0 Event, trouve ${count}`);
  });

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  await record(`HTTP GET ${baseUrl}/login`, async () => {
    const res = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    assert(res.status === 200, `Status ${res.status} (attendu 200)`);
    const body = await res.text();
    assert(body.length > 0, "Body vide");
  });

  await record(`HTTP GET ${baseUrl}/staff sans session`, async () => {
    const res = await fetch(`${baseUrl}/staff`, { redirect: "manual" });
    // NextAuth peut repondre 200 (HTML de redirect cote client) ou 302/307 (server redirect)
    assert(
      [200, 302, 307].includes(res.status),
      `Status ${res.status} inattendu pour /staff non auth`,
    );
  });

  await record(`HTTP GET ${baseUrl}/api/auth/providers`, async () => {
    const res = await fetch(`${baseUrl}/api/auth/providers`);
    assert(res.status === 200, `Status ${res.status} sur /api/auth/providers`);
    const json = (await res.json()) as Record<string, unknown>;
    assert("credentials" in json, "Provider credentials absent");
  });

  await prisma.$disconnect();
  return results;
}

async function main() {
  const results = await runChecks();

  for (const r of results) {
    const tag = r.ok ? "OK" : "FAIL";
    const line = `[${tag}] ${r.name}` + (r.detail ? ` -- ${r.detail}` : "");
    console.log(line);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} smoke test(s) en echec.`);
    process.exit(1);
  }
  console.log(`\nSmoke tests OK (${results.length}/${results.length}).`);
}

// Execution uniquement quand appele directement (pas en import test).
const isDirect =
  typeof require !== "undefined" ? require.main === module : false;
if (isDirect || process.argv[1]?.endsWith("smoke-tests.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
