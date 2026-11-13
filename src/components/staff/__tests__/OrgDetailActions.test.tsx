import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { OrgDetailActions } from "@/app/platform/organizations/[orgId]/OrgDetailActions";

const org = { id: "o1", slug: "acme", archived: false };

function html(props: { canArchive: boolean; canDelete: boolean; archived?: boolean }) {
  return renderToStaticMarkup(
    <OrgDetailActions org={{ ...org, archived: props.archived ?? false }} canArchive={props.canArchive} canDelete={props.canDelete} />,
  );
}

describe("OrgDetailActions", () => {
  it("sans aucun droit : rien n'est affiché", () => {
    expect(html({ canArchive: false, canDelete: false })).toBe("");
  });

  it("organizations.archive seul : Archiver, pas de suppression", () => {
    const out = html({ canArchive: true, canDelete: false });
    expect(out).toContain("Archiver");
    expect(out).not.toContain("Supprimer définitivement");
    expect(out).toContain("réservée aux super administrateurs");
  });

  it("organisation archivée : Restaurer à la place d'Archiver", () => {
    const out = html({ canArchive: true, canDelete: false, archived: true });
    expect(out).toContain("Restaurer");
    expect(out).not.toContain(">Archiver<");
  });

  it("organizations.delete seul : suppression sans archivage", () => {
    const out = html({ canArchive: false, canDelete: true });
    expect(out).not.toContain("Archiver");
    expect(out).toContain("Supprimer définitivement");
  });

  it("les deux droits : archivage et suppression", () => {
    const out = html({ canArchive: true, canDelete: true });
    expect(out).toContain("Archiver");
    expect(out).toContain("Supprimer définitivement");
  });
});
