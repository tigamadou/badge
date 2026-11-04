import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { NotificationDTO } from "@/lib/notifications/types";
import { NotificationsList } from "../NotificationsView";

const now = new Date("2026-10-24T12:00:00Z");

function dto(over: Partial<NotificationDTO>): NotificationDTO {
  return {
    id: "n1",
    type: "REGISTRATION_CREATED",
    title: "Nouvelle inscription",
    body: "Awa s'est inscrite à Forum.",
    href: "/event/e1/registrations/r1",
    links: [
      { label: "Voir l'inscription", href: "/event/e1/registrations/r1" },
      { label: "Voir l'évènement", href: "/event/e1" },
    ],
    readAt: null,
    createdAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
    ...over,
  };
}

describe("NotificationsList", () => {
  it("chaque élément porte l'ancre n-<id> et la classe target:", () => {
    const html = renderToStaticMarkup(<NotificationsList items={[dto({}), dto({ id: "n2" })]} now={now} />);
    expect(html).toContain('id="n-n1"');
    expect(html).toContain('id="n-n2"');
    expect(html).toContain("target:ring-2");
    expect(html).toContain("target:ring-navy");
  });

  it("le nom dans le corps est le lien, sans bouton rempli", () => {
    const html = renderToStaticMarkup(
      <NotificationsList
        items={[
          dto({
            body: "Awa s'est inscrite à Forum.",
            links: [
              { label: "Voir l'inscription", href: "/event/e1/registrations/r1", anchor: "Awa" },
              { label: "Voir l'évènement", href: "/event/e1", anchor: "Forum" },
            ],
          }),
        ]}
        now={now}
      />,
    );
    expect(html).toContain('href="/event/e1/registrations/r1"');
    expect(html).toMatch(/<a [^>]*href="\/event\/e1\/registrations\/r1"[^>]*>Awa<\/a>/);
    expect(html).toMatch(/<a [^>]*href="\/event\/e1"[^>]*>Forum<\/a>/);
    expect(html).not.toMatch(/<a [^>]*bg-navy/);
    expect(html).not.toContain("Voir l&#x27;inscription");
    expect(html).toContain("il y a 5 min");
  });

  it("sans ancre exploitable : le titre devient le lien principal, lien secondaire en texte", () => {
    const html = renderToStaticMarkup(<NotificationsList items={[dto({})]} now={now} />);
    expect(html).toMatch(/<a [^>]*href="\/event\/e1\/registrations\/r1"[^>]*>Nouvelle inscription<\/a>/);
    expect(html).toMatch(/<a [^>]*href="\/event\/e1"[^>]*>Voir l&#x27;évènement<\/a>/);
    expect(html).not.toMatch(/<a [^>]*bg-navy/);
  });

  it("marque « Non lue » les notifications sans readAt", () => {
    const html = renderToStaticMarkup(
      <NotificationsList items={[dto({}), dto({ id: "n2", readAt: now.toISOString() })]} now={now} />,
    );
    expect(html.match(/Non lue/g)).toHaveLength(1);
  });

  it("n'affiche aucun lien pour une notification sans liens", () => {
    const html = renderToStaticMarkup(<NotificationsList items={[dto({ links: [] })]} now={now} />);
    expect(html).not.toContain("<a ");
  });
});
