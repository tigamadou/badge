import type { BadgeTemplate } from "./types";
import { meta as defaultV1Meta } from "./default-v1/meta";
import DefaultV1Template from "./default-v1/template";
import { meta as rectoVersoV1Meta } from "./recto-verso-v1/meta";
import RectoVersoV1Template from "./recto-verso-v1/template";

// Registry des templates de badge v2. Cles = `meta.id` (slug kebab-case).
// Ajoute un nouveau template :
//   1. cree `src/lib/badge-templates/<id>/{meta.ts,template.tsx,preview.png}`
//   2. importe ici et ajoute l'entree au record
// Le script `scripts/validate-badge-templates.ts` (CI) verifie qu'aucune ligne
// en BDD ne reference un templateId orphelin.
export const BADGE_TEMPLATES = {
  "default-v1": { meta: defaultV1Meta, Component: DefaultV1Template },
  "recto-verso-v1": { meta: rectoVersoV1Meta, Component: RectoVersoV1Template },
} as const satisfies Record<string, BadgeTemplate>;

export type BadgeTemplateId = keyof typeof BADGE_TEMPLATES;

export function getTemplate(id: string): BadgeTemplate | null {
  return (BADGE_TEMPLATES as Record<string, BadgeTemplate>)[id] ?? null;
}

export function listTemplates(): BadgeTemplate[] {
  return Object.values(BADGE_TEMPLATES);
}

// Template par defaut absolu : utilise par les fallbacks si la cascade
// resout un id orphelin du registry (cf. /api/.../badges/[badgeId] route).
export const DEFAULT_TEMPLATE_ID = "default-v1" as const;
