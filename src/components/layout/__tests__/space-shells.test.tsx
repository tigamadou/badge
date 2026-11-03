import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/notifications/NotificationBell", () => ({
  NotificationBell: ({ scope }: { scope: unknown }) => (
    <span data-testid="bell" data-scope={JSON.stringify(scope)} />
  ),
}));

import { StaffShell } from "@/components/staff/StaffShell";
import { OrgShell } from "@/components/admin/OrgShell";
import { EventShell } from "@/components/event/EventShell";
import { EventOperatorShell } from "@/components/event/EventOperatorShell";
import { EventPrinterShell } from "@/components/event/EventPrinterShell";
import { EventViewerShell } from "@/components/event/EventViewerShell";

function bellScope(html: string): unknown {
  const m = /data-scope="([^"]*)"/.exec(html);
  return JSON.parse(m![1].replaceAll("&quot;", '"'));
}

const user = { name: "Awa Diallo", email: "awa@x.test" };
const org = { id: "o1", name: "Acme", slug: "acme" };
const event = {
  id: "e1",
  title: "Salon",
  slug: "salon",
  date: new Date("2026-10-01"),
  archived: false,
  registrationOpen: true,
};

describe("StaffShell", () => {
  const html = renderToStaticMarkup(
    <StaffShell user={{ ...user, staffRole: "STAFF_OBSERVER" }} pendingPrintRequests={2}>
      <p>x</p>
    </StaffShell>,
  );

  it("place la cloche en portée platform", () => {
    expect(bellScope(html)).toEqual({ kind: "platform" });
  });

  it("affiche l'entrée Commandes avec son compteur", () => {
    expect(html).toContain("Commandes");
    expect(html).toContain('aria-label="2 en attente"');
  });

  it("ajoute les entrées Notifications et Emails", () => {
    expect(html).toContain('href="/platform/notifications"');
    expect(html).toContain('href="/platform/jobs"');
    expect(html).toContain("Emails");
  });

  it("ordonne les groupes Impression puis Plateforme", () => {
    const at = (t: string) => html.indexOf(t);
    expect(at("Impression")).toBeGreaterThan(-1);
    expect(at("Impression")).toBeLessThan(at("Commandes"));
    expect(at("Commandes")).toBeLessThan(at("Planches"));
    expect(at("Planches")).toBeLessThan(at("Gabarits"));
    expect(at("Gabarits")).toBeLessThan(at("Catalogue"));
    expect(at("Catalogue")).toBeLessThan(at(">Plateforme<"));
    expect(at(">Plateforme<")).toBeLessThan(at("Emails"));
    expect(at("Emails")).toBeLessThan(at("Paramètres"));
    expect(at("Paramètres")).toBeLessThan(at("Journal"));
  });

  it("affiche l'avatar à initiales", () => {
    expect(html).toContain(">AD</span>");
    expect(html).toContain("width:30px");
  });
});

describe("OrgShell", () => {
  const html = renderToStaticMarkup(
    <OrgShell org={org} user={{ ...user, isStaff: false }} orgs={[org]} orgRole="AUDITOR">
      <p>x</p>
    </OrgShell>,
  );

  it("place la cloche en portée org", () => {
    expect(bellScope(html)).toEqual({ kind: "org", orgId: "o1" });
  });

  it("ajoute l'entrée Notifications et l'avatar", () => {
    expect(html).toContain('href="/org/o1/notifications"');
    expect(html).toContain(">AD</span>");
  });
});

describe("EventShell", () => {
  const html = renderToStaticMarkup(
    <EventShell org={org} event={event} effectiveRole="ADMIN" isStaffMode={false} user={user}>
      <p>x</p>
    </EventShell>,
  );

  it("place la cloche en portée event", () => {
    expect(bellScope(html)).toEqual({ kind: "event", eventId: "e1" });
  });

  it("ajoute l'entrée Notifications et l'avatar", () => {
    expect(html).toContain('href="/event/e1/notifications"');
    expect(html).toContain(">AD</span>");
  });
});

describe.each([
  ["EventOperatorShell", EventOperatorShell],
  ["EventPrinterShell", EventPrinterShell],
  ["EventViewerShell", EventViewerShell],
])("%s", (_name, Shell) => {
  const html = renderToStaticMarkup(
    <Shell org={org} event={event} user={user}>
      <p>x</p>
    </Shell>,
  );

  it("place la cloche en portée event", () => {
    expect(bellScope(html)).toEqual({ kind: "event", eventId: "e1" });
  });

  it("ajoute l'entrée Notifications avant Profil", () => {
    const notif = html.indexOf('href="/event/e1/notifications"');
    expect(notif).toBeGreaterThanOrEqual(0);
    expect(notif).toBeLessThan(html.indexOf('href="/profile"'));
  });

  it("affiche désormais un avatar", () => {
    expect(html).toContain(">AD</span>");
  });
});
