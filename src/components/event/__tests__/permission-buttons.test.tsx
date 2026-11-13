import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/event/e1/registrations",
  useSearchParams: () => new URLSearchParams(),
}));

import { RegistrationTable } from "../RegistrationTable";
import { RegistrationActions } from "../RegistrationActions";
import { RegistrationDetailPanel } from "../RegistrationDetailPanel";
import { CategoryTable } from "../CategoryTable";
import { EventSettingsForm } from "../EventSettingsForm";
import type { Permission } from "@/lib/permissions";

describe("RegistrationTable", () => {
  it("lecture détaillée seule : ni Exporter ni Inscription", () => {
    const html = renderToStaticMarkup(
      <RegistrationTable orgId="o1" eventId="e1" permissions={["event.read.detailed"]} />,
    );
    expect(html).not.toContain("Exporter");
    expect(html).not.toContain("/registrations/new");
  });

  it("avec export et création : les deux boutons", () => {
    const html = renderToStaticMarkup(
      <RegistrationTable orgId="o1" eventId="e1" permissions={["registration.export", "registration.create"]} />,
    );
    expect(html).toContain("Exporter");
    expect(html).toContain("/registrations/new");
  });
});

const actionsProps = {
  orgId: "o1",
  eventId: "e1",
  registrationId: "r1",
  badgePrinted: false,
  profileApproved: true,
  reasons: [],
  onChanged: () => {},
};

describe("RegistrationActions", () => {
  it("en attente : Approuver et Rejeter seulement avec registration.approve", () => {
    const sans = renderToStaticMarkup(<RegistrationActions {...actionsProps} status="PENDING" permissions={["event.read.detailed"]} />);
    expect(sans).not.toContain("Approuver");
    expect(sans).not.toContain("Rejeter");
    const avec = renderToStaticMarkup(<RegistrationActions {...actionsProps} status="PENDING" permissions={["registration.approve"]} />);
    expect(avec).toContain("Approuver");
    expect(avec).toContain("Rejeter");
  });

  it("approuvée : Marquer imprimé seulement avec badge.print", () => {
    const sans = renderToStaticMarkup(<RegistrationActions {...actionsProps} status="APPROVED" permissions={["registration.approve"]} />);
    expect(sans).not.toContain("Marquer imprimé");
    const avec = renderToStaticMarkup(<RegistrationActions {...actionsProps} status="APPROVED" permissions={["badge.print"]} />);
    expect(avec).toContain("Marquer imprimé");
  });
});

const reg = {
  id: "r1",
  firstName: "Awa",
  lastName: "Diallo",
  email: "awa@example.org",
  structure: "Acme",
  status: "APPROVED" as const,
  badgePrinted: false,
  badgePrintedAt: null,
  allAccessGranted: false,
  rejectionReason: null,
  rejectionDetails: null,
  photo: "p",
  idDocument: "d",
  idDocumentReadable: false,
  profileStatus: "APPROVED" as const,
  profileReviewedAt: null,
  idDocumentType: "CNI",
  idDocumentNumber: "123",
  createdAt: "2026-10-01T00:00:00.000Z",
  category: { id: "c1", name: "Visiteur", color: "#112233", number: 1 },
};

function panel(permissions: Permission[]) {
  return renderToStaticMarkup(
    <RegistrationDetailPanel orgId="o1" eventId="e1" registration={reg} rejectionReasons={[]} permissions={permissions} />,
  );
}

describe("RegistrationDetailPanel", () => {
  it("lecture seule : aucune action avancée", () => {
    const html = panel(["event.read.detailed"]);
    expect(html).not.toContain("ALL ACCESS");
    expect(html).not.toContain("Voir le badge");
    expect(html).not.toContain("Bloquer cet e-mail");
    expect(html).not.toContain("Supprimer");
  });

  it("chaque permission ouvre sa propre action", () => {
    expect(panel(["registration.all_access"])).toContain("Activer ALL ACCESS");
    expect(panel(["badge.print"])).toContain("Voir le badge");
    const block = panel(["registration.block"]);
    expect(block).toContain("Bloquer cet e-mail");
    expect(block).toContain("Bloquer ce document");
    expect(panel(["registration.delete"])).toContain("Supprimer");
  });
});

describe("CategoryTable", () => {
  const props = { orgId: "o1", eventId: "e1", rows: [], allCategories: [] };
  it("sans event.categories.manage : lecture seule", () => {
    const html = renderToStaticMarkup(<CategoryTable {...props} permissions={["event.read.detailed"]} />);
    expect(html).not.toContain("Ajouter");
    expect(html).not.toContain("Importer un modèle");
  });
  it("avec event.categories.manage : ajout et import", () => {
    const html = renderToStaticMarkup(<CategoryTable {...props} permissions={["event.categories.manage"]} />);
    expect(html).toContain("Ajouter");
    expect(html).toContain("Importer un modèle");
  });
});

describe("EventSettingsForm", () => {
  const initial = {
    event: {
      id: "e1", title: "Salon", location: "Cotonou", description: null, slug: "salon", logo: null, banner: null,
      logoOriginal: null, bannerOriginal: null, registrationOpen: true, securityInstructions: [],
      date: "2026-10-01T00:00:00.000Z", endDate: null,
    },
    settings: { contactEmail: null, contactPhone: null },
    resolved: { contactEmail: null, contactPhone: null },
    options: [],
    optionValues: {},
    storedOptions: {},
  };
  const render = (permissions: Permission[]) =>
    renderToStaticMarkup(
      <EventSettingsForm orgId="o1" eventId="e1" initial={initial as never} imageRequirements={{}} imageIssues={{}} permissions={permissions} />,
    );

  it("event.settings.update seul : informations en lecture seule, sans Enregistrer", () => {
    const html = render(["event.settings.update"]);
    expect(html).toContain("<fieldset disabled");
    expect(html).toContain("pas les modifier");
    expect(html.match(/>Enregistrer</g)).toHaveLength(1); // celui du contact seulement
  });

  it("avec event.update : champs modifiables et Enregistrer", () => {
    const html = render(["event.settings.update", "event.update", "event.registration_toggle"]);
    expect(html).not.toContain("<fieldset disabled");
    expect(html.match(/>Enregistrer</g)).toHaveLength(2);
  });

  it("sans event.registration_toggle : l'interrupteur des inscriptions est désactivé", () => {
    const html = render(["event.settings.update", "event.update"]);
    expect(html).toMatch(/<fieldset disabled[^>]*><button[^>]*role="switch"/);
  });
});
