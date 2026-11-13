import { describe, expect, it, vi } from "vitest";
import { makeEvent, makeEventMember, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories } from "@/test/factories";

vi.mock("@/content/page-docs/index.generated", async () => ({
  PAGE_DOC_INDEX: (await import("./fixtures")).FIXTURE_INDEX,
}));
vi.mock("@/content/page-docs/manifest.generated", async () => ({
  PAGE_DOCS: (await import("./fixtures")).FIXTURE_DOCS,
}));
import { docsHrefFor, listDocsForUser, loadDocById, loadDocForUser, summaryOf } from "../index";

seedFactories(4102);

describe("loadDocForUser", () => {
  it("OWNER voit le bloc org.update, AUDITOR non (filtrage côté serveur)", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    const auditor = await makeOrgMember(org.id, "AUDITOR");
    const forOwner = await loadDocForUser(owner.id, `/org/${org.id}`);
    expect(forOwner?.html).toContain("Secret des propriétaires.");
    expect(forOwner?.html).toContain("<h2>Modifier</h2>");
    expect(forOwner).toMatchObject({
      id: "org/index",
      title: "Accueil de l'organisation",
      updatedAt: "2026-11-20",
      audience: "organisateur",
      docsHref: `/org/${org.id}/docs`,
    });
    const forAuditor = await loadDocForUser(auditor.id, `/org/${org.id}`);
    expect(forAuditor?.html).toContain("votre organisation");
    expect(JSON.stringify(forAuditor)).not.toContain("Secret des propriétaires.");
    expect(JSON.stringify(forAuditor)).not.toContain("Modifier");
  });

  it("une doc sans bloc est servie telle quelle", async () => {
    const user = await makeUser();
    const doc = await loadDocForUser(user.id, "/account");
    expect(doc?.html).toContain("Voir vos inscriptions.");
    expect(doc?.docsHref).toBe("/account/docs");
  });

  it("null : pas de doc, aucun droit sur la cible, compte archivé, évènement d'une autre organisation", async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    const owner = await makeOrgMember(orgA.id, "OWNER");
    const archived = await makeOrgMember(orgA.id, "OWNER", { archived: true });
    const eventB = await makeEvent(orgB.id);
    const stranger = await makeUser();
    expect(await loadDocForUser(owner.id, `/org/${orgA.id}/inconnu`)).toBeNull();
    expect(await loadDocForUser(stranger.id, `/org/${orgA.id}`)).toBeNull();
    expect(await loadDocForUser(archived.id, `/org/${orgA.id}`)).toBeNull();
    expect(await loadDocForUser(owner.id, `/event/${eventB.id}`)).toBeNull();
    expect(await loadDocForUser(owner.id, "/event/inconnu")).toBeNull();
  });

  it("access : la doc n'est servie qu'à qui détient la permission exigée", async () => {
    const org = await makeOrg();
    const manager = await makeOrgMember(org.id, "MANAGER");
    const auditor = await makeOrgMember(org.id, "AUDITOR");
    expect(await loadDocForUser(manager.id, `/org/${org.id}/events/new`)).not.toBeNull();
    expect(await loadDocForUser(auditor.id, `/org/${org.id}/events/new`)).toBeNull();
    expect(await loadDocForUser(auditor.id, `/org/${org.id}/events`)).not.toBeNull();
  });

  it("imprimeur sur une page plateforme : selon access", async () => {
    const printer = await makeStaff("STAFF_PRINTER");
    const observer = await makeStaff("STAFF_OBSERVER");
    expect(await loadDocForUser(printer.id, "/platform/organizations")).toBeNull();
    expect((await loadDocForUser(observer.id, "/platform/organizations"))?.title).toBe("Organisations");
    expect((await loadDocForUser(printer.id, "/platform/vide"))?.html).toContain("Seulement un titre");
  });

  it("bloc d'une autre portée que la cible : contenu gardé avec la mention « Réservé… »", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const viewer = await makeEventMember(event.id, "VIEWER");
    const doc = await loadDocForUser(viewer.id, `/event/${event.id}`);
    expect(doc?.html).toContain("Section d'organisation.");
    expect(doc?.html).toContain("Réservé aux utilisateurs disposant de la permission");
    expect(doc?.html).toContain("Chiffres clés.");
    expect(doc?.docsHref).toBe(`/event/${event.id}/docs`);
  });
});

describe("loadDocById", () => {
  it("charge une doc par identifiant avec les identifiants de l'espace", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    expect((await loadDocById(owner.id, "org/index", { orgId: org.id }))?.title).toBe("Accueil de l'organisation");
    expect(await loadDocById(owner.id, "org/absent", { orgId: org.id })).toBeNull();
    expect(await loadDocById(owner.id, "org/index", {})).toBeNull();
  });
});

describe("listDocsForUser", () => {
  it("exclut les docs dont access n'est pas détenu, garde celles sans access, ordre des identifiants", async () => {
    const org = await makeOrg();
    const manager = await makeOrgMember(org.id, "MANAGER");
    const agent = await makeOrgMember(org.id, "AGENT");
    const list = await listDocsForUser(manager.id, "org", { orgId: org.id });
    expect(list.map((d) => d.id)).toEqual(["org/events", "org/events/new", "org/index"]);
    expect(list[0]).toEqual({
      id: "org/events",
      slug: "events",
      section: "events",
      title: "Évènements",
      summary: "Liste des évènements de l'organisation.",
      updatedAt: "2026-11-20",
    });
    expect(list[2]).toMatchObject({ slug: "index", section: "Accueil", summary: "Vue d'ensemble de votre organisation." });
    const forAgent = await listDocsForUser(agent.id, "org", { orgId: org.id });
    expect(forAgent.map((d) => d.id)).toEqual(["org/events", "org/index"]);
  });

  it("le résumé est calculé sur le corps filtré : pas de phrase d'un bloc non détenu", async () => {
    const org = await makeOrg();
    const manager = await makeOrgMember(org.id, "MANAGER");
    const owner = await makeOrgMember(org.id, "OWNER");
    const summaryFor = async (id: string) =>
      (await listDocsForUser(id, "org", { orgId: org.id })).find((d) => d.id === "org/events/new")?.summary;
    expect(await summaryFor(manager.id)).toBe("Créez un évènement.");
    expect(await summaryFor(owner.id)).toBe("Phrase réservée.");
  });

  it("liste vide : espace sans doc, aucun droit sur la cible", async () => {
    const org = await makeOrg();
    const owner = await makeOrgMember(org.id, "OWNER");
    const stranger = await makeUser();
    expect(await listDocsForUser(owner.id, "org", {})).toEqual([]);
    expect(await listDocsForUser(stranger.id, "org", { orgId: org.id })).toEqual([]);
  });

  it("espace plateforme et résumé vide", async () => {
    const observer = await makeStaff("STAFF_OBSERVER");
    const list = await listDocsForUser(observer.id, "platform", {});
    expect(list.map((d) => d.id)).toEqual(["platform/organizations", "platform/vide"]);
    expect(list[1].summary).toBe("");
  });
});

describe("helpers", () => {
  it("docsHrefFor couvre les quatre espaces", () => {
    expect(docsHrefFor("platform", {})).toBe("/platform/docs");
    expect(docsHrefFor("account", {})).toBe("/account/docs");
    expect(docsHrefFor("org", { orgId: "o" })).toBe("/org/o/docs");
    expect(docsHrefFor("event", { eventId: "e" })).toBe("/event/e/docs");
  });

  it("summaryOf : première phrase, hors titres, marqueurs, tableaux et mise en forme", () => {
    expect(summaryOf("# T\n\n:::permission x\n| a |\n\n- **Gras** et [lien](/x). Suite.")).toBe("Gras et lien.");
    expect(summaryOf("Sans ponctuation finale")).toBe("Sans ponctuation finale");
    expect(summaryOf("# Titre seul\n")).toBe("");
    expect(summaryOf("")).toBe("");
  });
});
