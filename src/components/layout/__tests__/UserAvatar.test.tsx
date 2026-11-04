import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserAvatar, UserAvatarView } from "../UserAvatar";

describe("UserAvatar", () => {
  it("affiche au plus deux initiales en majuscules", () => {
    const html = renderToStaticMarkup(<UserAvatar name="awa diallo kone" />);
    expect(html).toContain(">AD</span>");
  });

  it("ignore les espaces superflus et retombe sur « ? »", () => {
    expect(renderToStaticMarkup(<UserAvatar name="  Jean   Dupont " />)).toContain(">JD<");
    for (const name of [null, "", "   "]) {
      expect(renderToStaticMarkup(<UserAvatar name={name} />)).toContain(">?<");
    }
  });

  it("utilise 32 px par défaut et respecte size", () => {
    expect(renderToStaticMarkup(<UserAvatar name="Awa Diallo" />)).toContain(
      "width:32px;height:32px",
    );
    expect(renderToStaticMarkup(<UserAvatar name="Awa Diallo" size={30} />)).toContain(
      "width:30px;height:30px",
    );
  });

  it("affiche la photo en cercle quand photoUrl est fourni", () => {
    const html = renderToStaticMarkup(
      <UserAvatar name="Awa Diallo" photoUrl="/api/files/profile/u1/photos/p.png" size={30} />,
    );
    expect(html).toContain('src="/api/files/profile/u1/photos/p.png"');
    expect(html).toContain('alt="Photo de profil"');
    expect(html).toContain("object-cover");
    expect(html).toContain("rounded-full");
    expect(html).not.toContain(">AD<");
  });

  it("affiche les initiales sans photoUrl", () => {
    for (const photoUrl of [null, undefined]) {
      const html = renderToStaticMarkup(<UserAvatar name="Awa Diallo" photoUrl={photoUrl} />);
      expect(html).not.toContain("<img");
      expect(html).toContain("AD");
    }
  });

  it("UserAvatarView en échec (photoUrl null) rend les initiales et la taille demandée", () => {
    const html = renderToStaticMarkup(
      <UserAvatarView name="Awa Diallo" photoUrl={null} size={30} />,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("AD");
    expect(html).toContain("width:30px");
    expect(html).toContain('data-testid="user-avatar"');
  });

  it("utilise la palette mist / marine", () => {
    const html = renderToStaticMarkup(<UserAvatar name="Awa Diallo" />);
    expect(html).toContain("bg-mist");
    expect(html).toContain("text-navy");
    expect(html).not.toContain("bg-slate-200");
  });

  it("nom absent : repli « ? » même sans photo", () => {
    expect(renderToStaticMarkup(<UserAvatar name={null} />)).toContain("?");
  });
});
