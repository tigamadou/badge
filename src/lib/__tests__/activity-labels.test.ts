import { describe, it, expect } from "vitest";
import type { ActivityType } from "@prisma/client";
import { logKind, describeActivity, extractDiff } from "@/lib/activity-labels";

// Liste exhaustive des valeurs de l'enum ActivityType (source : prisma/schema.prisma).
// Sert a couvrir describeActivity pour TOUTES les valeurs (cas mappe + fallback).
const ALL_ACTIVITY_TYPES = [
  "REGISTRATION_CREATED",
  "REGISTRATION_APPROVED",
  "REGISTRATION_REJECTED",
  "REGISTRATION_UPDATED",
  "REGISTRATION_DELETED",
  "REGISTRATION_RESUBMITTED",
  "REGISTRATION_SNAPSHOT_REFRESHED",
  "BADGE_PRINTED",
  "BADGE_BATCH_PRINTED",
  "BADGE_ALL_ACCESS_TOGGLED",
  "BADGE_EXPORTED",
  "BADGE_BATCH_EXPORTED",
  "BADGE_SCANNED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "USER_PASSWORD_SET",
  "USER_LOGIN",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "CATEGORY_DELETED",
  "CATEGORY_TEMPLATE_CREATED",
  "CATEGORY_TEMPLATE_UPDATED",
  "CATEGORY_TEMPLATE_DELETED",
  "ORG_CREATED",
  "ORG_UPDATED",
  "ORG_ARCHIVED",
  "ORG_RESTORED",
  "EVENT_CREATED",
  "EVENT_UPDATED",
  "EVENT_ARCHIVED",
  "EVENT_RESTORED",
  "EVENT_REGISTRATION_OPENED",
  "EVENT_REGISTRATION_CLOSED",
  "MEMBERSHIP_ADDED",
  "MEMBERSHIP_REMOVED",
  "MEMBERSHIP_ROLE_CHANGED",
  "PLATFORM_SETTINGS_UPDATED",
  "EVENT_SETTINGS_UPDATED",
  "JOB_RETRIED",
  "JOB_CANCELLED",
  "USER_REGISTERED",
  "USER_EMAIL_VERIFIED",
  "USER_PASSWORD_RESET_REQUESTED",
  "USER_PASSWORD_RESET_COMPLETED",
  "USER_PROFILE_UPDATED",
  "USER_BLOCKED",
  "USER_UNBLOCKED",
  "ORG_DELETED",
  "PLATFORM_BLOCKED_EMAIL_ADDED",
  "PLATFORM_BLOCKED_EMAIL_REMOVED",
  "PLATFORM_BLOCKED_DOCUMENT_ADDED",
  "PLATFORM_BLOCKED_DOCUMENT_REMOVED",
  "PLAN_CREATED",
  "PLAN_UPDATED",
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_UPDATED",
  "QUOTA_BYPASS",
] as const;

const as = (s: string) => s as ActivityType;

describe("logKind", () => {
  it("classifies the connexion category (USER_LOGIN)", () => {
    expect(logKind(as("USER_LOGIN"))).toBe("connexion");
  });

  it("classifies creation via *_CREATED suffix", () => {
    expect(logKind(as("REGISTRATION_CREATED"))).toBe("creation");
    expect(logKind(as("EVENT_CREATED"))).toBe("creation");
  });

  it("classifies creation via the explicit non-suffix cases", () => {
    expect(logKind(as("MEMBERSHIP_ADDED"))).toBe("creation");
    expect(logKind(as("USER_REGISTERED"))).toBe("creation");
    expect(logKind(as("ORG_RESTORED"))).toBe("creation");
    expect(logKind(as("EVENT_RESTORED"))).toBe("creation");
  });

  it("classifies suppression via *_DELETED and *_ARCHIVED suffixes", () => {
    expect(logKind(as("REGISTRATION_DELETED"))).toBe("suppression");
    expect(logKind(as("ORG_ARCHIVED"))).toBe("suppression");
    expect(logKind(as("EVENT_ARCHIVED"))).toBe("suppression");
  });

  it("classifies suppression via the explicit membership/block cases", () => {
    expect(logKind(as("MEMBERSHIP_REMOVED"))).toBe("suppression");
    expect(logKind(as("USER_BLOCKED"))).toBe("suppression");
  });

  it("classifies acces (scan / print / export)", () => {
    expect(logKind(as("BADGE_SCANNED"))).toBe("acces");
    expect(logKind(as("BADGE_PRINTED"))).toBe("acces");
    expect(logKind(as("BADGE_BATCH_PRINTED"))).toBe("acces");
    expect(logKind(as("BADGE_EXPORTED"))).toBe("acces");
    expect(logKind(as("BADGE_BATCH_EXPORTED"))).toBe("acces");
  });

  it("classifies modification via *_UPDATED and settings suffixes", () => {
    expect(logKind(as("REGISTRATION_UPDATED"))).toBe("modification");
    expect(logKind(as("PLATFORM_SETTINGS_UPDATED"))).toBe("modification");
    expect(logKind(as("EVENT_SETTINGS_UPDATED"))).toBe("modification");
  });

  it("classifies modification via the explicit membership/password cases", () => {
    expect(logKind(as("MEMBERSHIP_ROLE_CHANGED"))).toBe("modification");
    expect(logKind(as("USER_PASSWORD_SET"))).toBe("modification");
  });

  it("falls back to systeme for anything else (evaluates every operand)", () => {
    // REGISTRATION_RESUBMITTED ne matche aucune branche : chaque condition de
    // chaque `if` est evaluee et fausse, ce qui exerce tous les operandes || .
    expect(logKind(as("REGISTRATION_RESUBMITTED"))).toBe("systeme");
    expect(logKind(as("QUOTA_BYPASS"))).toBe("systeme");
    expect(logKind(as("USER_EMAIL_VERIFIED"))).toBe("systeme");
  });
});

describe("REGISTRATION_SNAPSHOT_REFRESHED", () => {
  it("est classe comme une modification", () => {
    expect(logKind(as("REGISTRATION_SNAPSHOT_REFRESHED"))).toBe("modification");
  });

  it("a un libelle humain", () => {
    expect(describeActivity(as("REGISTRATION_SNAPSHOT_REFRESHED"))).toBe(
      "Inscription mise a jour depuis le profil",
    );
  });
});

describe("types d'impression (gabarits et planches)", () => {
  const PRINT_TYPES = [
    "PRINT_LAYOUT_CREATED",
    "PRINT_LAYOUT_UPDATED",
    "PRINT_LAYOUT_ARCHIVED",
    "PRINT_SHEETS_GENERATED",
  ] as const;

  it("ont un libelle humain different du type brut", () => {
    for (const t of PRINT_TYPES) {
      const label = describeActivity(as(t));
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(t);
    }
  });

  it("sont classes par categorie visuelle", () => {
    expect(logKind(as("PRINT_LAYOUT_CREATED"))).toBe("creation");
    expect(logKind(as("PRINT_LAYOUT_UPDATED"))).toBe("modification");
    expect(logKind(as("PRINT_LAYOUT_ARCHIVED"))).toBe("suppression");
    expect(logKind(as("PRINT_SHEETS_GENERATED"))).toBe("acces");
  });

  it("couvrent le catalogue de produits", () => {
    for (const t of ["PRINT_PRODUCT_CREATED", "PRINT_PRODUCT_UPDATED", "PRINT_PRODUCT_ARCHIVED"] as const) {
      const label = describeActivity(as(t));
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(t);
    }
    expect(logKind(as("PRINT_PRODUCT_CREATED"))).toBe("creation");
    expect(logKind(as("PRINT_PRODUCT_UPDATED"))).toBe("modification");
    expect(logKind(as("PRINT_PRODUCT_ARCHIVED"))).toBe("suppression");
  });
});

describe("types des demandes d'impression", () => {
  const REQUEST_TYPES = [
    "PRINT_REQUEST_SUBMITTED",
    "PRINT_REQUEST_UPDATED",
    "PRINT_REQUEST_QUOTED",
    "PRINT_REQUEST_ACCEPTED",
    "PRINT_REQUEST_REOPENED",
    "PRINT_REQUEST_STATUS_CHANGED",
    "PRINT_REQUEST_CANCELLED",
    "PRINT_REQUEST_REJECTED",
    "PRINT_REQUEST_MARKED_PAID",
  ] as const;

  it("ont un libelle humain different du type brut", () => {
    for (const t of REQUEST_TYPES) {
      const label = describeActivity(as(t));
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(t);
    }
  });

  it("sont classes par categorie visuelle", () => {
    expect(logKind(as("PRINT_REQUEST_UPDATED"))).toBe("modification");
    expect(logKind(as("PRINT_REQUEST_QUOTED"))).toBe("systeme");
  });
});

describe("describeActivity", () => {
  const KNOWN: Partial<Record<string, string>> = {
    REGISTRATION_CREATED: "Inscription créée",
    BADGE_SCANNED: "Badge scanné",
    ORG_CREATED: "Organisation créée",
    EVENT_SETTINGS_UPDATED: "Paramètres d'événement modifiés",
    JOB_RETRIED: "Email relancé",
    JOB_CANCELLED: "Email annulé",
  };

  it("returns the French label for mapped types", () => {
    expect(describeActivity(as("REGISTRATION_CREATED"))).toBe("Inscription créée");
    expect(describeActivity(as("BADGE_SCANNED"))).toBe("Badge scanné");
    expect(describeActivity(as("PLATFORM_SETTINGS_UPDATED"))).toBe(
      "Paramètres plateforme modifiés",
    );
  });

  it("falls back to the raw type string for unmapped types", () => {
    expect(describeActivity(as("QUOTA_BYPASS"))).toBe("QUOTA_BYPASS");
    expect(describeActivity(as("USER_EMAIL_VERIFIED"))).toBe("USER_EMAIL_VERIFIED");
  });

  it("returns a non-empty string for every ActivityType value", () => {
    for (const t of ALL_ACTIVITY_TYPES) {
      const label = describeActivity(as(t));
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
      if (KNOWN[t]) {
        expect(label).toBe(KNOWN[t]);
      }
    }
  });
});

describe("extractDiff", () => {
  it("returns [] when details is null or not an object", () => {
    expect(extractDiff(null)).toEqual([]);
    expect(extractDiff(undefined)).toEqual([]);
    expect(extractDiff("not-an-object")).toEqual([]);
    expect(extractDiff(42)).toEqual([]);
  });

  it("returns [] when changes is missing or not an object", () => {
    expect(extractDiff({})).toEqual([]);
    expect(extractDiff({ changes: null })).toEqual([]);
    expect(extractDiff({ changes: "nope" })).toEqual([]);
  });

  it("extracts rows for entries shaped like { from, to }", () => {
    const rows = extractDiff({
      changes: {
        title: { from: "Ancien", to: "Nouveau" },
        location: { from: "Paris", to: "Lyon" },
      },
    });
    expect(rows).toEqual([
      { field: "title", from: "Ancien", to: "Nouveau" },
      { field: "location", from: "Paris", to: "Lyon" },
    ]);
  });

  it("skips entries that are not shaped like { from, to }", () => {
    const rows = extractDiff({
      changes: {
        nullVal: null,
        stringVal: "x",
        onlyFrom: { from: "1" },
        onlyTo: { to: "2" },
        valid: { from: "a", to: "b" },
      },
    });
    expect(rows).toEqual([{ field: "valid", from: "a", to: "b" }]);
  });

  it("uses the em-dash fallback for null from/to values", () => {
    const rows = extractDiff({
      changes: {
        photo: { from: null, to: null },
      },
    });
    expect(rows).toEqual([{ field: "photo", from: "—", to: "—" }]);
  });
});
