import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PlatformSettingsForm, type PublicSettings } from "../PlatformSettingsForm";

const initial: PublicSettings = {
  smtpHost: "smtp.test",
  smtpPort: 587,
  smtpFrom: "a@b.test",
  smtpUser: "u",
  smtpSecure: true,
  smtpPasswordSet: true,
  recaptchaEnabled: false,
  recaptchaSiteKey: "",
  recaptchaSecretKeySet: false,
};

describe("PlatformSettingsForm", () => {
  it("sans settings.update : lecture seule, aucun bouton d'enregistrement", () => {
    const html = renderToStaticMarkup(<PlatformSettingsForm section="smtp" initial={initial} />);
    expect(html).toContain("<fieldset disabled");
    expect(html).toContain("lecture seule");
    expect(html).not.toContain("Enregistrer les paramètres");
  });

  it("avec settings.update sans secrets : formulaire actif, champ secret désactivé et avertissement", () => {
    const html = renderToStaticMarkup(<PlatformSettingsForm section="smtp" initial={initial} canEdit />);
    expect(html).not.toContain("<fieldset disabled");
    expect(html).toContain("Enregistrer les paramètres");
    expect(html).toContain("réservé au super administrateur");
  });

  it("avec settings.update et settings.secrets.update : aucun avertissement", () => {
    const html = renderToStaticMarkup(<PlatformSettingsForm section="recaptcha" initial={initial} canEdit canEditSecrets />);
    expect(html).toContain("Enregistrer les paramètres");
    expect(html).not.toContain("réservé au super administrateur");
  });
});
