import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CreateEventButton } from "../CreateEventButton";

describe("CreateEventButton", () => {
  it("rend un lien quand la création est permise", () => {
    const html = renderToStaticMarkup(<CreateEventButton orgId="o1" canCreate subscriptionActive />);
    expect(html).toContain('href="/org/o1/events/new"');
    expect(html).not.toContain("disabled");
  });

  it("abonnement inactif : bouton désactivé, texte « Abonnement inactif » et lien abonnement", () => {
    const html = renderToStaticMarkup(<CreateEventButton orgId="o1" canCreate={false} subscriptionActive={false} />);
    expect(html).toContain("disabled");
    expect(html).toContain("aria-describedby=\"create-event-disabled-hint\"");
    expect(html).toContain('id="create-event-disabled-hint"');
    expect(html).toContain("Abonnement inactif");
    expect(html).toContain('href="/org/o1/subscription"');
  });

  it("abonnement actif sans droit de créer : texte neutre, jamais « Abonnement inactif »", () => {
    const html = renderToStaticMarkup(<CreateEventButton orgId="o1" canCreate={false} subscriptionActive />);
    expect(html).toContain("disabled");
    expect(html).toContain("n’est pas disponible avec votre abonnement");
    expect(html).not.toContain("Abonnement inactif");
    expect(html).not.toContain("/subscription");
  });
});
