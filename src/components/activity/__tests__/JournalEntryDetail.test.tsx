import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { JournalEntryDetail, type JournalEntry } from "../JournalEntryDetail";

const entry = (user: JournalEntry["user"]): JournalEntry => ({
  id: "log1",
  type: "ORG_UPDATED",
  createdAt: new Date("2026-11-13T10:00:00Z"),
  staffActor: true,
  ipAddress: null,
  userAgent: null,
  details: {},
  targetId: null,
  user,
});

const render = (user: JournalEntry["user"]) =>
  renderToString(<JournalEntryDetail log={entry(user)} backHref="/platform/activity" backLabel="Retour" />);

const base = { id: "u1", name: "Alice", email: "a@x.fr" };

describe("JournalEntryDetail — rôle de l'auteur", () => {
  it("affiche le nom du rôle de plateforme quand il est fourni", () => {
    const html = render({ ...base, staffRole: "STAFF_ADMIN", platformRole: { name: "Imprimeur" } });
    expect(html).toContain("Imprimeur");
    expect(html).not.toContain("STAFF_ADMIN");
  });

  it("retombe sur l'ancien staffRole sans platformRole", () => {
    const html = render({ ...base, staffRole: "STAFF_ADMIN" });
    expect(html).toContain("STAFF_ADMIN");
  });

  it("n'affiche aucun rôle sans l'un ni l'autre", () => {
    const html = render({ ...base, staffRole: null, platformRole: null });
    expect(html).not.toContain("STAFF_");
    expect(html).not.toContain("Imprimeur");
  });
});
