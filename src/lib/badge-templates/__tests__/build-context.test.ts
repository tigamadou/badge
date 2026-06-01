import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildTemplateContext, __TEST__, type RegistrationForContext } from "../build-context";

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
