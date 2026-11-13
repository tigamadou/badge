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

vi.mock("@/components/page-docs/PageDocButton", () => ({
  PageDocButton: () => <i data-testid="doc-button" />,
}));

import { StaffShell } from "@/components/staff/StaffShell";
import { OrgShell } from "@/components/admin/OrgShell";
import { EventShell } from "@/components/event/EventShell";
import { EventOperatorShell } from "@/components/event/EventOperatorShell";
import { EventPrinterShell } from "@/components/event/EventPrinterShell";
import { EventViewerShell } from "@/components/event/EventViewerShell";

function noDarkClasses(html: string) {
  for (const banned of ["text-white", "text-slate-300", "text-slate-400", "hover:bg-white/10"]) {
    expect(html).not.toContain(banned);
  }
}

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

describe("menu clair des shells d'évènement", () => {
  const sidebarHtml = (node: React.ReactElement) => renderToStaticMarkup(node);

  it("EventShell : titre marine, organisation grise, bandeau staff marine", () => {
    const html = sidebarHtml(
      <EventShell org={org} event={event} effectiveRole="ADMIN" isStaffMode={true} user={user}>
        <p>x</p>
      </EventShell>,
    );
    expect(html).toMatch(/<div class="[^"]*text-navy[^"]*">Salon<\/div>/);
    expect(html).toContain("text-nav-muted");
    expect(html).toContain("bg-navy/10");
    // Bandeau staff : bande marine, texte blanc (seul usage de text-white).
    expect(html).toMatch(/class="bg-navy[^"]*text-white[^"]*"[^>]*>\s*<strong/);
    expect(html).not.toContain("bg-amber-50");
    expect(html).not.toContain("text-slate-300 hover:bg-white/10");
  });

  it.each([
    ["EventOperatorShell", EventOperatorShell],
    ["EventPrinterShell", EventPrinterShell],
    ["EventViewerShell", EventViewerShell],
  ])("%s : titre marine, liens SIDEBAR_LINK, aucune classe sombre", (_n, Shell) => {
    const html = sidebarHtml(
      <Shell org={org} event={event} user={user}>
        <p>x</p>
      </Shell>,
    );
    expect(html).toMatch(/<div class="[^"]*text-navy[^"]*">Salon<\/div>/);
    expect(html).toContain("px-2 text-xs text-nav-muted\">Acme");
    expect(html).toContain("hover:bg-mist hover:text-navy");
    noDarkClasses(html);
  });
});

describe("ancrage de la documentation", () => {
  it("StaffShell : lien Documentation vers /platform/docs, bouton avant la cloche", () => {
    const html = renderToStaticMarkup(
      <StaffShell user={{ ...user, staffRole: "STAFF_OBSERVER" }} pendingPrintRequests={0}>
        <p>x</p>
      </StaffShell>,
    );
    expect(html).toContain('href="/platform/docs"');
    expect(html).toContain("Documentation");
    expect(html.indexOf("/platform/docs")).toBeGreaterThan(html.indexOf(">Plateforme<"));
    expect(html.indexOf('data-testid="doc-button"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="doc-button"')).toBeLessThan(html.indexOf('data-testid="bell"'));
  });

  it.each(["OWNER", "MANAGER", "AUDITOR"] as const)("OrgShell %s : lien Documentation", (role) => {
    const html = renderToStaticMarkup(
      <OrgShell org={org} user={{ ...user, isStaff: false }} orgs={[org]} orgRole={role}>
        <p>x</p>
      </OrgShell>,
    );
    expect(html).toContain('href="/org/o1/docs"');
    expect(html.indexOf('data-testid="doc-button"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="doc-button"')).toBeLessThan(html.indexOf('data-testid="bell"'));
  });

  it("EventShell : lien Documentation, dans Administration, bouton avant la cloche", () => {
    const html = renderToStaticMarkup(
      <EventShell org={org} event={event} effectiveRole="VIEWER" isStaffMode={false} user={user}>
        <p>x</p>
      </EventShell>,
    );
    expect(html).toContain('href="/event/e1/docs"');
    expect(html.indexOf("Administration")).toBeLessThan(html.indexOf('href="/event/e1/docs"'));
    expect(html.indexOf('data-testid="doc-button"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="doc-button"')).toBeLessThan(html.indexOf('data-testid="bell"'));
  });
});
