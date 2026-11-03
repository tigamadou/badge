// Onglets de /platform/settings, pilotes par ?tab= (lien direct, rechargement).
export const PLATFORM_SETTINGS_TABS = [
  { value: "email", label: "E-mails", adminOnly: false },
  { value: "security", label: "Sécurité", adminOnly: false },
  { value: "subscriptions", label: "Abonnements", adminOnly: false },
  { value: "reasons", label: "Motifs de rejet", adminOnly: false },
  { value: "badge", label: "Badge", adminOnly: true },
  { value: "onsite-print", label: "Impression sur place", adminOnly: true },
] as const;

export type PlatformSettingsTab = (typeof PLATFORM_SETTINGS_TABS)[number]["value"];

export function visibleSettingsTabs(isStaffAdmin: boolean) {
  return PLATFORM_SETTINGS_TABS.filter((t) => isStaffAdmin || !t.adminOnly);
}

// Onglet inconnu ou non autorise : retour sur le premier onglet.
export function resolveSettingsTab(raw: string | undefined, isStaffAdmin: boolean): PlatformSettingsTab {
  const tabs = visibleSettingsTabs(isStaffAdmin);
  return tabs.find((t) => t.value === raw)?.value ?? tabs[0].value;
}
