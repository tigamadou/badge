import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Permission } from "@/lib/permissions/catalog";
import { PermissionMatrix } from "../PermissionMatrix";
import { RoleSelect } from "../RoleSelect";
import { RoleTable } from "../RoleTable";
import { RoleEditor } from "../RoleEditor";
import { UserPermissionsEditor } from "../UserPermissionsEditor";
import { LevelSwitcher } from "../LevelSwitcher";
import type { AssignableRoleRow, PermissionLevelRow, RoleRow } from "../types";

// Balise <input> d'une permission dans le rendu statique (l'ordre des attributs est celui de React).
const inputOf = (html: string, key: string) => html.match(new RegExp(`<input[^>]*value="${key.replace(/\./g, "\\.")}"[^>]*>`))![0];

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe("PermissionMatrix", () => {
  it("ne rend jamais une permission réservée et groupe par domaine", () => {
    const html = renderToStaticMarkup(<PermissionMatrix levels={["PLATFORM", "ORG", "EVENT"]} selected={new Set()} />);
    expect(html).not.toContain("platform.roles.manage");
    expect(html).not.toContain("users.permissions.manage");
    expect(html.match(/<table/g)!.length).toBeGreaterThan(1);
    expect(html).toContain("Espace plateforme");
    expect(html).toContain("Espace organisation");
    expect(html).toContain("Espace évènement");
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/role="tabpanel"[^>]*hidden/g)).toHaveLength(2);
    expect(html).toContain("org.update");
  });

  it("rend un interrupteur par permission et compte les actives par domaine", () => {
    const html = renderToStaticMarkup(<PermissionMatrix levels={["ORG"]} selected={new Set<Permission>(["org.read"])} />);
    expect(inputOf(html, "org.read")).toContain('role="switch"');
    expect(html).toMatch(/>1\/\d+</);
  });

  it("coche la sélection ; une case désactivée porte la raison en infobulle", () => {
    const html = renderToStaticMarkup(
      <PermissionMatrix
        levels={["ORG"]}
        selected={new Set<Permission>(["org.read"])}
        disabled={new Map<Permission, string>([["org.update", "Vous ne détenez pas cette permission."]])}
      />,
    );
    expect(inputOf(html, "org.read")).toContain("checked");
    expect(html).toMatch(/title="Vous ne détenez pas cette permission."/);
    expect(inputOf(html, "org.update")).toContain("disabled");
  });

  it("en lecture seule toutes les cases sont désactivées", () => {
    const html = renderToStaticMarkup(<PermissionMatrix levels={["EVENT"]} selected={new Set()} readOnly />);
    const boxes = html.match(/<input[^>]*>/g)!;
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every((b) => b.includes("disabled"))).toBe(true);
  });
});

describe("RoleSelect", () => {
  const roles: AssignableRoleRow[] = [
    { id: "1", name: "Propriétaire", systemKey: "OWNER", scope: "ORG", description: null, assignable: false, reason: "Permission non détenue" },
    { id: "2", name: "Agent", systemKey: "AGENT", scope: "ORG", description: null, assignable: true },
    { id: "3", name: "Perso", systemKey: null, scope: "ORG", description: null, assignable: true },
  ];

  it("regroupe système et personnalisés, grise les rôles non attribuables", () => {
    const html = renderToStaticMarkup(<RoleSelect roles={roles} value="" onChange={() => undefined} name="roleId" />);
    expect(html).toContain('label="Rôles système"');
    expect(html).toContain('label="Rôles personnalisés"');
    expect(html).toMatch(/value="1"[^>]*disabled/);
    expect(html).not.toMatch(/value="2"[^>]*disabled/);
    expect(html).toContain("Permission non détenue");
    expect(html).toContain("Choisir un rôle");
  });

  it("sans valeur vide ni rôle personnalisé", () => {
    const html = renderToStaticMarkup(
      <RoleSelect roles={[roles[1]]} value="2" onChange={() => undefined} name="roleId" label="Rôle d'organisation" />,
    );
    expect(html).not.toContain("Choisir un rôle");
    expect(html).not.toContain("Rôles personnalisés");
    expect(html).toContain("Rôle d&#x27;organisation");
  });
});

describe("RoleSelect compact", () => {
  it("n'affiche pas d'étiquette visible mais garde un nom accessible", () => {
    const role: AssignableRoleRow = { id: "1", name: "Agent", systemKey: "AGENT", scope: "ORG", description: null, assignable: true };
    const html = renderToStaticMarkup(<RoleSelect roles={[role]} value="1" onChange={() => undefined} name="r" label="Rôle de a@b.fr" compact />);
    expect(html).not.toContain("<label");
    expect(html).toContain('aria-label="Rôle de a@b.fr"');
  });
});

describe("RoleTable", () => {
  const base: RoleRow = { id: "r", scope: "ORG", systemKey: null, name: "Perso", description: "Desc", orgId: "o", archived: false, permissions: ["org.read"], assignedCount: 2 };
  const sys: RoleRow = { ...base, id: "s", systemKey: "OWNER", name: "Propriétaire", description: null, assignedCount: undefined, permissions: [] };
  const archived: RoleRow = { ...base, id: "a", name: "Ancien", archived: true, assignedCount: 1 };

  it("pastille Système, compteurs, liens et actions", () => {
    const html = renderToStaticMarkup(
      <RoleTable roles={[base, sys, archived]} apiBase="/api/org/o/roles" editHref="/e/:id" duplicateHref="/d/:id" canManage />,
    );
    expect(html).toContain("Système");
    expect(html).toContain("2 membres");
    expect(html).toContain("1 membre<");
    expect(html).toContain("0 permission");
    expect(html).toContain("1 permission");
    expect(html).toContain('href="/e/r"');
    expect(html).toContain('href="/d/s"');
    expect(html).toContain("Archiver");
    expect(html).toContain("Restaurer");
    expect(html).toContain("Archivé");
    expect(html).toContain('href="/e/s"');
    expect(html).not.toContain('href="/e/a"');
  });

  it("sans droit de gestion ni duplication : aucune action", () => {
    const html = renderToStaticMarkup(
      <RoleTable roles={[base]} apiBase="/x" editHref="/e/:id" canManage={false} />,
    );
    expect(html).not.toContain("Archiver");
    expect(html).not.toContain("Dupliquer");
    expect(html).not.toContain("Modifier");
  });
});

describe("RoleEditor", () => {
  it("création : champs, matrice sans réservées, permissions non détenues désactivées", () => {
    const html = renderToStaticMarkup(
      <RoleEditor mode="create" scope="ORG" apiBase="/api/org/o/roles" heldPermissions={["org.read"]} redirectTo="/org/o/roles" sendScope />,
    );
    expect(html).toContain("Nom du rôle");
    expect(html).toContain("Créer le rôle");
    expect(inputOf(html, "org.read")).not.toContain("disabled");
    expect(inputOf(html, "org.update")).toContain("disabled");
  });

  it("duplication : nom suffixé ; édition : permissions déjà portées restent cochables", () => {
    const initial = { id: "r", name: "Perso", description: "d", permissions: ["org.update" as Permission] };
    const dup = renderToStaticMarkup(
      <RoleEditor mode="duplicate" scope="ORG" initial={initial} apiBase="/x" heldPermissions={[]} redirectTo="/y" />,
    );
    expect(dup).toContain("Perso (copie)");
    expect(dup).toContain("Créer la copie");
    const edit = renderToStaticMarkup(
      <RoleEditor mode="edit" scope="ORG" initial={initial} apiBase="/x" heldPermissions={[]} redirectTo="/y" />,
    );
    expect(edit).toContain("Enregistrer");
    expect(inputOf(edit, "org.update")).toContain("checked");
    expect(inputOf(edit, "org.update")).not.toContain("disabled");
  });
});

describe("UserPermissionsEditor", () => {
  const platform: PermissionLevelRow = {
    target: { kind: "platform" },
    role: { id: "p", name: "Administrateur", systemKey: "STAFF_ADMIN" },
    inherited: ["org.read"],
    overrides: [{ permission: "org.update", effect: "GRANT" }],
    effective: ["org.read", "org.update"],
  };
  const org: PermissionLevelRow = {
    target: { kind: "org", orgId: "o", orgName: "Acme" },
    role: null,
    inherited: [],
    overrides: [],
    effective: [],
  };

  it("un bloc par niveau, état courant et permissions non détenues non ajoutables", () => {
    const html = renderToStaticMarkup(
      <UserPermissionsEditor levels={[platform, org]} endpoint="/api/e" heldPermissions={["org.read"]} scopes={["ORG"]} sendOrgId />,
    );
    expect(html).toContain("Plateforme");
    expect(html).toContain("Acme");
    expect(html).toContain("Administrateur");
    expect(html).not.toContain("platform.roles.manage");
    expect(html).toContain("Vous ne détenez pas cette permission.");
    expect(inputOf(html, "org.read")).toContain('role="switch"');
    expect(inputOf(html, "org.read")).toContain("checked");
    expect(inputOf(html, "org.update")).toContain("checked");
    expect(html).toContain('id="platform-org-read"');
    expect(html).toContain('id="o-org-read"');
    expect(html).toContain("Enregistrer");
  });

  it("présente les espaces en onglets", () => {
    const html = renderToStaticMarkup(
      <UserPermissionsEditor levels={[org]} endpoint="/api/e" heldPermissions={["org.read"]} scopes={["ORG", "EVENT"]} sendOrgId={false} />,
    );
    expect(html).toContain("Espace organisation");
    expect(html).toContain("Espace évènement");
    expect(html.match(/role="tab"/g)).toHaveLength(2);
  });
});

describe("LevelSwitcher", () => {
  it("un seul niveau : pas de sélecteur ; plusieurs : seul le premier est visible", () => {
    const one = renderToStaticMarkup(<LevelSwitcher items={[{ value: "a", label: "A", content: <p>contenu A</p> }]} />);
    expect(one).toBe("<p>contenu A</p>");
    const two = renderToStaticMarkup(
      <LevelSwitcher
        items={[
          { value: "a", label: "Plateforme", content: <p>A</p> },
          { value: "b", label: "Acme", content: <p>B</p> },
        ]}
      />,
    );
    expect(two).toContain("Plateforme");
    expect(two).toContain("Acme");
    expect(two.match(/<div hidden="">/g)).toHaveLength(1);
  });
});
