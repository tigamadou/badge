import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { NotificationDTO } from "@/lib/notifications/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/event/e1",
}));

import { NotificationBellButton } from "../NotificationBell";
import { NotificationPanel, NotificationPanelList } from "../NotificationPanel";

const now = new Date("2026-10-24T12:00:00Z");

function dto(over: Partial<NotificationDTO>): NotificationDTO {
  return {
    id: "n1",
    type: "REGISTRATION_CREATED",
    title: "Nouvelle inscription",
    body: "Awa s'est inscrite.",
    href: "/x",
    links: [],
    readAt: null,
    createdAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
    ...over,
  };
}

describe("NotificationBellButton", () => {
  it("pastille masquée et aria-label simple à 0", () => {
    const html = renderToStaticMarkup(<NotificationBellButton count={0} open={false} onToggle={() => {}} />);
    expect(html).toContain('aria-label="Notifications"');
    expect(html).not.toContain("bg-rose-600");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("h-10 w-10");
  });

  it("aria-label « Notifications, 3 non lues » et pastille 3", () => {
    const html = renderToStaticMarkup(<NotificationBellButton count={3} open onToggle={() => {}} />);
    expect(html).toContain('aria-label="Notifications, 3 non lues"');
    expect(html).toContain(">3<");
    expect(html).toContain('aria-expanded="true"');
  });

  it("pastille « 9+ » à 12", () => {
    const html = renderToStaticMarkup(<NotificationBellButton count={12} open={false} onToggle={() => {}} />);
    expect(html).toContain(">9+<");
    expect(html).toContain('aria-label="Notifications, 12 non lues"');
  });
});

describe("NotificationPanel", () => {
  it("la liste affiche titre, date relative et le point des non lues", () => {
    const html = renderToStaticMarkup(
      <NotificationPanelList
        items={[dto({}), dto({ id: "n2", title: "Badge imprimé", readAt: now.toISOString() })]}
        now={now}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain("Nouvelle inscription");
    expect(html).toContain("Badge imprimé");
    expect(html).toContain("il y a 5 min");
    expect(html.match(/aria-label="Non lue"/g)).toHaveLength(1);
  });

  it("la liste vide affiche « Aucune notification »", () => {
    const html = renderToStaticMarkup(<NotificationPanelList items={[]} now={now} onSelect={() => {}} />);
    expect(html).toContain("Aucune notification");
  });

  it("le panneau est plein écran sous sm", () => {
    const html = renderToStaticMarkup(
      <NotificationPanel scope={{ kind: "event", eventId: "e1" }} onClose={() => {}} onChanged={() => {}} />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Notifications"');
    expect(html).toContain("fixed inset-0");
    expect(html).toContain("sm:absolute");
    expect(html).toContain("Tout marquer comme lu");
    expect(html).toContain('href="/event/e1/notifications"');
    expect(html).toContain("Voir toutes les notifications");
  });
});
