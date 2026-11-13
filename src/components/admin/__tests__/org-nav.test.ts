import { describe, expect, it } from "vitest";
import { makeOrg, makeOrgMember, makeStaff, seedFactories } from "@/test/factories";
import { effectivePermissions } from "@/lib/permissions";
import { loadUserContext } from "@/lib/user-context";
import { orgNavFor } from "../org-nav";

seedFactories(2201);

async function labelsFor(key: "OWNER" | "MANAGER" | "AUDITOR" | "AGENT") {
  const org = await makeOrg();
  const user = await makeOrgMember(org.id, key);
  const ctx = (await loadUserContext(user.id))!;
  const nav = orgNavFor(org.id, effectivePermissions(ctx, { kind: "org", orgId: org.id }));
  return { org, nav, labels: nav.map((n) => n.label) };
}

describe("orgNavFor", () => {
  it("OWNER : toutes les entrées, dont Rôles vers /org/O/roles", async () => {
    const { org, nav, labels } = await labelsFor("OWNER");
    expect(labels).toEqual([
      "Tableau de bord", "Notifications", "Événements", "Membres", "Rôles", "Modèles catégories",
      "Abonnement", "Paiements", "Paramètres", "Journal", "Documentation",
    ]);
    expect(nav.find((n) => n.label === "Rôles")).toMatchObject({ href: `/org/${org.id}/roles`, icon: "shield" });
    expect(nav[0]).toMatchObject({ href: `/org/${org.id}`, exact: true });
  });

  it("MANAGER : ni Rôles ni Paramètres", async () => {
    const { labels } = await labelsFor("MANAGER");
    expect(labels).not.toContain("Rôles");
    expect(labels).not.toContain("Paramètres");
    expect(labels).toContain("Abonnement");
    expect(labels).toContain("Paiements");
  });

  it("AUDITOR : consultation seule", async () => {
    const { labels } = await labelsFor("AUDITOR");
    expect(labels).toEqual([
      "Tableau de bord", "Notifications", "Événements", "Membres", "Modèles catégories", "Journal", "Documentation",
    ]);
  });

  it("AGENT : tableau de bord, notifications et évènements seulement", async () => {
    const { labels } = await labelsFor("AGENT");
    expect(labels).toEqual(["Tableau de bord", "Notifications", "Événements", "Documentation"]);
  });

  it("Observateur plateforme : lecture sans Rôles", async () => {
    const org = await makeOrg();
    const staff = await makeStaff("STAFF_OBSERVER");
    const ctx = (await loadUserContext(staff.id))!;
    const labels = orgNavFor(org.id, effectivePermissions(ctx, { kind: "org", orgId: org.id })).map((n) => n.label);
    expect(labels).toContain("Abonnement");
    expect(labels).not.toContain("Rôles");
    expect(labels).not.toContain("Paramètres");
  });
});
