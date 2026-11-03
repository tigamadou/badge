import { hash } from "bcryptjs";
import { Faker, fr, en, base } from "@faker-js/faker";
import { Prisma } from "@prisma/client";
import type { EventRole, OrgRole, RegistrationStatus, StaffRole } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma";
import { assertDemoSeedAllowed } from "../../../src/lib/badge-env";
import { deleteFile, deletePrefix, getFile, uploadFile } from "../../../src/lib/storage";
import { DEMO_FAKER_SEED, DEMO_PASSWORD, DEMO_STORAGE_PREFIX } from "../constants";

export type OrgSize = "huge" | "medium" | "small" | "archived";
export type EventPhase = "past" | "ongoing" | "upcoming";
export type DemoSpecialCase =
  | "blocked" | "unverifiedEmail" | "multiOrg" | "organizerAndParticipant" | "archivedUser"
  | "invitationPending" | "invitationExpired" | "invitationAccepted"
  | "profilePending" | "profileRejected" | "profileIncomplete";

/** Noms de modèles Prisma (camelCase du client) acceptés par backdate. */
export type BackdatableModel =
  | "registration" | "profileSubmission" | "user" | "organization" | "event"
  | "printRequest" | "printRequestMessage" | "printRequestPrint" | "printQuoteLine" | "orgPrintCredit"
  | "printSheetGeneration" | "payment" | "subscription" | "notification" | "activityLog" | "job";

export type DemoUser = { id: string; email: string; name: string };
export type DemoCategory = { id: string; number: number; name: string; anonymous: boolean; neutralBadge: boolean };
export type DemoOrg = {
  id: string; slug: string; name: string; size: OrgSize; archived: boolean; badgeTemplateId: string | null;
};
export type DemoEvent = {
  id: string; slug: string; title: string; orgId: string; phase: EventPhase;
  date: Date; endDate: Date | null; archived: boolean; registrationOpen: boolean;
  badgeTemplateId: string | null; categories: DemoCategory[];
};
export type DemoRegistrationRef = {
  id: string;            // identifiant métier imprimé sur le badge
  userId: string; eventId: string; categoryId: string;
  status: RegistrationStatus; badgePrinted: boolean;
};

export type DemoRegistry = {
  staff: Record<StaffRole, DemoUser[]>;
  orgMembers: Map<string /* orgId */, Record<OrgRole, DemoUser[]>>;
  eventMembers: Map<string /* eventId */, Record<EventRole, DemoUser[]>>;
  participants: DemoUser[];
  special: Partial<Record<DemoSpecialCase, DemoUser>>;
  orgs: DemoOrg[];
  orgsBySize: Record<OrgSize, DemoOrg[]>;
  events: DemoEvent[];
  eventsByPhase: Record<EventPhase, DemoEvent[]>;
  eventsByOrg: Map<string /* orgId */, DemoEvent[]>;
  registrations: Map<string /* eventId */, Record<RegistrationStatus, DemoRegistrationRef[]>>;
};

export type DemoSeedOptions = {
  env?: Record<string, string | undefined>;
  scale?: number;
  now?: Date;
  storagePrefix?: string;
  accountsFile?: string | null;
};

export type DemoContext = {
  faker: Faker;
  scale: number;
  scaled(n: number, min?: number): number;
  env: "dev" | "preprod";
  passwordHash: string;
  dates: {
    now: Date;
    daysFromNow(days: number, hour?: number): Date;
    daysAgo(days: number, hour?: number): Date;
    between(minDaysAgo: number, maxDaysAgo: number): Date;
  };
  storage: {
    prefix: string;
    key(...parts: string[]): string;
    put(key: string, body: Buffer, contentType: string): Promise<string>;
    clear(): Promise<number>;
    putAt(key: string, body: Buffer, contentType: string): Promise<string>;
    trackKey(key: string): void;
    flushTrackedKeys(): Promise<void>;
    clearTracked(): Promise<number>;
  };
  backdate(model: BackdatableModel, ids: string | string[], createdAt: Date, updatedAt?: Date): Promise<void>;
  parkJobs(since?: Date, runAt?: Date): Promise<number>;
  images: { photos: string[]; logos: string[]; banners: string[] };
  registry: DemoRegistry;
  recordAccount(email: string, role: string, scenario: string): void;
  accounts: Array<{ email: string; role: string; scenario: string }>;
};

const DAY_MS = 86_400_000;
const TRACKED_KEYS_FILE = "_tracked-keys.json";

const BACKDATABLE_MODELS: readonly BackdatableModel[] = [
  "registration", "profileSubmission", "user", "organization", "event",
  "printRequest", "printRequestMessage", "printRequestPrint", "printQuoteLine", "orgPrintCredit",
  "printSheetGeneration", "payment", "subscription", "notification", "activityLog", "job",
];

const quoteId = (name: string) => `\`${name.replace(/`/g, "")}\``;

function assertSafeKey(key: string): void {
  if (!key || key.startsWith("/") || key.includes("..") || key.includes("\\")) {
    throw new Error(`Cle de stockage invalide : "${key}"`);
  }
}

function emptyRegistry(): DemoRegistry {
  return {
    staff: { SUPER_ADMIN: [], STAFF_ADMIN: [], STAFF_SUPPORT: [], STAFF_OBSERVER: [] },
    orgMembers: new Map(),
    eventMembers: new Map(),
    participants: [],
    special: {},
    orgs: [],
    orgsBySize: { huge: [], medium: [], small: [], archived: [] },
    events: [],
    eventsByPhase: { past: [], ongoing: [], upcoming: [] },
    eventsByOrg: new Map(),
    registrations: new Map(),
  };
}

function resolveScale(options: DemoSeedOptions, env: Record<string, string | undefined>): number {
  const scale = options.scale ?? Number(env.DEMO_SCALE ?? 1);
  if (!Number.isFinite(scale) || scale < 0) {
    throw new Error(`DEMO_SCALE invalide : ${String(options.scale ?? env.DEMO_SCALE)}`);
  }
  return scale;
}

function createDates(now: Date, faker: Faker): DemoContext["dates"] {
  const shift = (days: number, hour = 9) => {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  return {
    now,
    daysFromNow: (days, hour) => shift(days, hour),
    daysAgo: (days, hour) => shift(-days, hour),
    between: (minDaysAgo, maxDaysAgo) =>
      faker.date.between({
        from: new Date(now.getTime() - maxDaysAgo * DAY_MS),
        to: new Date(now.getTime() - minDaysAgo * DAY_MS),
      }),
  };
}

function createStorage(rawPrefix: string): DemoContext["storage"] {
  const prefix = rawPrefix.endsWith("/") ? rawPrefix : `${rawPrefix}/`;
  const tracked = new Set<string>();
  const manifestKey = `${prefix}${TRACKED_KEYS_FILE}`;

  const key = (...parts: string[]) => {
    const segments = parts.flatMap((p) => p.split("/"));
    if (parts.length === 0 || segments.some((s) => !s || s === ".." || s.includes("\\"))) {
      throw new Error(`Cle de stockage invalide : "${parts.join("/")}"`);
    }
    return prefix + parts.join("/");
  };

  return {
    prefix,
    key,
    async put(k, body, contentType) {
      assertSafeKey(k);
      if (!k.startsWith(prefix)) throw new Error(`Cle hors du prefixe ${prefix} : "${k}"`);
      return uploadFile(k, body, contentType);
    },
    clear: () => deletePrefix(prefix),
    async putAt(k, body, contentType) {
      assertSafeKey(k);
      const written = await uploadFile(k, body, contentType);
      tracked.add(k);
      return written;
    },
    trackKey(k) {
      assertSafeKey(k);
      tracked.add(k);
    },
    async flushTrackedKeys() {
      await uploadFile(manifestKey, Buffer.from(JSON.stringify([...tracked].sort())), "application/json");
    },
    async clearTracked() {
      let deleted = 0;
      let keys: unknown = [];
      try {
        keys = JSON.parse((await getFile(manifestKey)).body.toString("utf8"));
      } catch {
        // pas de manifeste lisible : seul le prefixe est nettoye
      }
      for (const k of Array.isArray(keys) ? keys : []) {
        if (typeof k !== "string" || k.startsWith(prefix)) continue;
        try {
          assertSafeKey(k);
        } catch {
          continue;
        }
        await deleteFile(k);
        deleted++;
      }
      tracked.clear();
      return deleted + (await deletePrefix(prefix));
    },
  };
}

function backdateColumns(model: BackdatableModel): { table: string; createdAt: string; updatedAt: string | null } {
  if (!BACKDATABLE_MODELS.includes(model)) throw new Error(`Modele non autorise pour backdate : ${String(model)}`);
  const meta = Prisma.dmmf.datamodel.models.find((m) => m.name.charAt(0).toLowerCase() + m.name.slice(1) === model);
  if (!meta) throw new Error(`Modele Prisma introuvable : ${model}`);
  const column = (name: string) => meta.fields.find((f) => f.name === name && f.kind === "scalar");
  const created = column("createdAt");
  if (!created) throw new Error(`Le modele ${model} n'a pas de createdAt`);
  const updated = column("updatedAt");
  return {
    table: meta.dbName ?? meta.name,
    createdAt: created.dbName ?? created.name,
    updatedAt: updated ? (updated.dbName ?? updated.name) : null,
  };
}

export async function createDemoContext(options: DemoSeedOptions = {}): Promise<DemoContext> {
  const env = options.env ?? process.env;
  const badgeEnv = assertDemoSeedAllowed(env);
  const scale = resolveScale(options, env);
  const now = options.now ?? new Date();

  const faker = new Faker({ locale: [fr, en, base] });
  faker.seed(DEMO_FAKER_SEED);

  const passwordHash = await hash(DEMO_PASSWORD, 12);
  const accounts: DemoContext["accounts"] = [];

  return {
    faker,
    scale,
    scaled: (n, min = 1) => Math.max(min, Math.round(n * scale)),
    env: badgeEnv,
    passwordHash,
    dates: createDates(now, faker),
    storage: createStorage(options.storagePrefix ?? DEMO_STORAGE_PREFIX),
    async backdate(model, ids, createdAt, updatedAt = createdAt) {
      const list = Array.isArray(ids) ? ids : [ids];
      const cols = backdateColumns(model);
      if (list.length === 0) return;
      const placeholders = list.map(() => "?").join(", ");
      const set = cols.updatedAt
        ? `${quoteId(cols.createdAt)} = ?, ${quoteId(cols.updatedAt)} = ?`
        : `${quoteId(cols.createdAt)} = ?`;
      const params: unknown[] = cols.updatedAt ? [createdAt, updatedAt] : [createdAt];
      await prisma.$executeRawUnsafe(
        `UPDATE ${quoteId(cols.table)} SET ${set} WHERE \`id\` IN (${placeholders})`,
        ...params,
        ...list,
      );
    },
    async parkJobs(since = now, runAt = new Date(now.getTime() + 3650 * DAY_MS)) {
      const res = await prisma.job.updateMany({
        where: { status: "PENDING", createdAt: { gte: since } },
        data: { runAt },
      });
      return res.count;
    },
    images: { photos: [], logos: [], banners: [] },
    registry: emptyRegistry(),
    recordAccount: (email, role, scenario) => {
      accounts.push({ email, role, scenario });
    },
    accounts,
  };
}

/** Insertion par lots : découpe `rows` en tranches de `size` (défaut 500) et appelle `insert` en séquence. */
export async function insertInBatches<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await insert(rows.slice(i, i + size));
  }
}
