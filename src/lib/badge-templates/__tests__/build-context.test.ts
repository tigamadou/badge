import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildTemplateContext, __TEST__, type RegistrationForContext } from "../build-context";

// Mock du driver de stockage pour exercer le VRAI readFileAsDataUrl (indirection
// normalement mockee via __TEST__). Le reste de @/lib/storage est preserve.
vi.mock("@/lib/storage", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/storage")>()),
  getFile: vi.fn(),
}));
import { getFile } from "@/lib/storage";

const baseRegistration: RegistrationForContext = {
  id: "REG-001",
  snapshotFirstName: "Awa",
  snapshotLastName: "Diallo",
  snapshotStructure: "ENSEA",
  snapshotPhoto: "events/evt/photos/abc.jpg",
  event: {
    title: "Salon 2026",
    date: new Date("2026-10-01"),
    location: "Abidjan",
    logo: "events/evt/logo.png",
  },
  category: {
    name: "Visiteur",
    color: "#4f46e5",
    neutralBadge: false,
    anonymous: false,
  },
};

describe("buildTemplateContext", () => {
  beforeEach(() => {
    vi.spyOn(__TEST__, "readFileAsDataUrl").mockImplementation(
      async (key: string) => `data:image/png;base64,STUB_${key}`,
    );
    vi.spyOn(__TEST__, "generateQRCodeDataURL").mockResolvedValue(
      "data:image/png;base64,STUB_QR",
    );
  });

  it("compose un contexte complet (photo + logo + QR)", async () => {
    const ctx = await buildTemplateContext(baseRegistration, {
      baseUrl: "https://badge.test",
    });
    expect(ctx.participant.firstName).toBe("Awa");
    expect(ctx.participant.lastName).toBe("Diallo");
    expect(ctx.participant.structure).toBe("ENSEA");
    expect(ctx.participant.photoDataUrl).toBe(
      "data:image/png;base64,STUB_events/evt/photos/abc.jpg",
    );
    expect(ctx.event.title).toBe("Salon 2026");
    expect(ctx.event.logoDataUrl).toBe(
      "data:image/png;base64,STUB_events/evt/logo.png",
    );
    expect(ctx.badge.id).toBe("REG-001");
    expect(ctx.badge.verifyUrl).toBe("https://badge.test/verify/REG-001");
    expect(ctx.badge.qrCodeDataUrl).toBe("data:image/png;base64,STUB_QR");
  });

  it("retourne logoDataUrl null si event.logo est null", async () => {
    const ctx = await buildTemplateContext(
      { ...baseRegistration, event: { ...baseRegistration.event, logo: null } },
      { baseUrl: "https://badge.test" },
    );
    expect(ctx.event.logoDataUrl).toBeNull();
  });

  it("retourne photoDataUrl vide si la lecture echoue", async () => {
    vi.mocked(__TEST__.readFileAsDataUrl).mockRejectedValueOnce(new Error("ENOENT"));
    const ctx = await buildTemplateContext(baseRegistration, {
      baseUrl: "https://badge.test",
    });
    expect(ctx.participant.photoDataUrl).toBe("");
  });

  it("retourne logoDataUrl null si la lecture du logo echoue", async () => {
    // Toutes les lectures echouent : photo -> "" (catch l.89), logo -> null (catch l.93).
    vi.mocked(__TEST__.readFileAsDataUrl).mockRejectedValue(new Error("ENOENT"));
    const ctx = await buildTemplateContext(baseRegistration, { baseUrl: "https://badge.test" });
    expect(ctx.event.logoDataUrl).toBeNull();
  });

  it("propage le flag anonymous depuis la category", async () => {
    const ctx = await buildTemplateContext(
      {
        ...baseRegistration,
        category: { ...baseRegistration.category, anonymous: true },
      },
      { baseUrl: "https://badge.test" },
    );
    expect(ctx.category.anonymous).toBe(true);
  });
});

describe("readFileAsDataUrl (implementation reelle via storage)", () => {
  beforeEach(() => {
    // Retire les spies sur __TEST__ poses par l'autre describe pour appeler le vrai.
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("utilise le contentType renvoye par le storage quand il est significatif", async () => {
    vi.mocked(getFile).mockResolvedValue({ body: Buffer.from("abc"), contentType: "image/png" });
    const url = await __TEST__.readFileAsDataUrl("events/x/photos/a.jpg", "");
    expect(url).toBe(`data:image/png;base64,${Buffer.from("abc").toString("base64")}`);
  });

  it("retombe sur le mime de l'extension si le storage renvoie application/octet-stream", async () => {
    vi.mocked(getFile).mockResolvedValue({ body: Buffer.from("z"), contentType: "application/octet-stream" });
    const url = await __TEST__.readFileAsDataUrl("x/y.webp", "");
    expect(url.startsWith("data:image/webp;base64,")).toBe(true);
  });

  it("retombe sur application/octet-stream pour une extension inconnue", async () => {
    vi.mocked(getFile).mockResolvedValue({ body: Buffer.from("z"), contentType: "" });
    const url = await __TEST__.readFileAsDataUrl("x/y.inconnu", "");
    expect(url.startsWith("data:application/octet-stream;base64,")).toBe(true);
  });

  it("resolveBaseUrl : sans baseUrl explicite, retombe sur l'env / le fallback", async () => {
    vi.mocked(getFile).mockResolvedValue({ body: Buffer.from("x"), contentType: "image/png" });
    // Pas de baseUrl -> resolveBaseUrl utilise BASE_URL/NEXTAUTH_URL/localhost.
    const ctx = await buildTemplateContext(baseRegistration);
    expect(ctx.badge.verifyUrl).toMatch(/\/verify\/REG-001$/);
  });

  it("resolveBaseUrl : utilise BASE_URL quand il est defini (2e operande du ||)", async () => {
    vi.mocked(getFile).mockResolvedValue({ body: Buffer.from("x"), contentType: "image/png" });
    vi.stubEnv("BASE_URL", "https://from-base-env.test");
    const ctx = await buildTemplateContext(baseRegistration);
    expect(ctx.badge.verifyUrl).toBe("https://from-base-env.test/verify/REG-001");
  });

  it("resolveBaseUrl : retombe sur NEXTAUTH_URL quand BASE_URL est vide (3e operande)", async () => {
    vi.mocked(getFile).mockResolvedValue({ body: Buffer.from("x"), contentType: "image/png" });
    vi.stubEnv("BASE_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "https://from-nextauth-env.test");
    const ctx = await buildTemplateContext(baseRegistration);
    expect(ctx.badge.verifyUrl).toBe("https://from-nextauth-env.test/verify/REG-001");
  });

  it("resolveBaseUrl : retombe sur localhost quand BASE_URL et NEXTAUTH_URL sont vides", async () => {
    vi.mocked(getFile).mockResolvedValue({ body: Buffer.from("x"), contentType: "image/png" });
    vi.stubEnv("BASE_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");
    const ctx = await buildTemplateContext(baseRegistration);
    expect(ctx.badge.verifyUrl).toBe("http://localhost:3000/verify/REG-001");
  });
});
