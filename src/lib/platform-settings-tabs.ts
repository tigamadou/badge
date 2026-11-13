import type { Permission } from "@/lib/permissions/catalog";

// Onglets de /platform/settings, pilotés par ?tab= (lien direct, rechargement).
// Chaque onglet porte la permission qui le rend visible (lecture ou, pour Badge et
// Impression sur place, droit de modification : l'onglet n'a pas de vue en lecture seule).
export const PLATFORM_SETTINGS_TABS = [
  { value: "email", label: "E-mails", permission: "settings.read" },
  { value: "security", label: "Sécurité", permission: "settings.read" },
  { value: "subscriptions", label: "Abonnements", permission: "settings.read" },
  { value: "reasons", label: "Motifs de rejet", permission: "rejection_reasons.read" },
  { value: "badge", label: "Badge", permission: "settings.badge_template.update" },
  { value: "onsite-print", label: "Impression sur place", permission: "settings.onsite_print.update" },
] as const satisfies readonly { value: string; label: string; permission: Permission }[];

export type PlatformSettingsTab = (typeof PLATFORM_SETTINGS_TABS)[number]["value"];

export function visibleSettingsTabs(permissions: ReadonlySet<Permission>) {
  return PLATFORM_SETTINGS_TABS.filter((t) => permissions.has(t.permission));
}

export function hasAnySettingsTab(permissions: ReadonlySet<Permission>): boolean {
  return visibleSettingsTabs(permissions).length > 0;
}

// Onglet inconnu ou non autorisé : retour sur le premier onglet visible (null si aucun).
export function resolveSettingsTab(
  raw: string | undefined,
  permissions: ReadonlySet<Permission>,
): PlatformSettingsTab | null {
  const tabs = visibleSettingsTabs(permissions);
  return tabs.find((t) => t.value === raw)?.value ?? tabs[0]?.value ?? null;
}
