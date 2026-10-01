import type { TemplateManifest, VariableDeclaration, VariableKind } from "@tigamadou/pdf-engine";
import { BADGE_CONTRACT, checkContract, contractKinds, reservedPrefixes } from "@tigamadou/pdf-engine/contracts";

// Les sources de badge SONT le contrat publie par le moteur : un seul endroit
// decrit ce que badge fournit, pour le studio comme pour l'application.
export const SOURCE_KINDS: Record<string, VariableKind> = Object.fromEntries(
  contractKinds(BADGE_CONTRACT),
);

// Liaison d'une variable hors contrat : sa valeur se regle par evenement
// (Event.templateOptions), cf. template-options.ts.
export const OPTION_BINDING = "option";

// Nom de variable -> chemin de source, ou null pour « laisser vide ». L'ABSENCE
// de cle n'est pas un choix : c'est une variable dont personne n'a decide, et
// c'est une erreur. Une variable non liee s'imprimerait vide sans que quiconque
// l'ait voulu.
export type Bindings = Record<string, string | null>;

export function validateBindings(
  variables: VariableDeclaration[],
  bindings: Bindings,
): string[] {
  const errors: string[] = [];
  const declared = new Set(variables.map((variable) => variable.name));

  // Object.hasOwn plutot que `in` ou un acces direct : une variable nommee
  // `constructor` ou `toString` serait sinon vue comme decidee via le prototype.
  for (const variable of variables) {
    if (!Object.hasOwn(bindings, variable.name)) {
      errors.push(`variable "${variable.name}" : aucune source choisie.`);
      continue;
    }
    const source = bindings[variable.name];
    if (source === null) continue;
    if (source === OPTION_BINDING) {
      const prefix = reservedPrefixes(BADGE_CONTRACT).find((p) => variable.name.startsWith(p));
      if (prefix) {
        errors.push(`variable "${variable.name}" : une option ne peut pas porter le préfixe réservé "${prefix}".`);
      }
      continue;
    }

    const kind = Object.hasOwn(SOURCE_KINDS, source) ? SOURCE_KINDS[source] : undefined;
    if (!kind) {
      errors.push(`variable "${variable.name}" : source inconnue "${source}".`);
      continue;
    }
    if (kind !== variable.kind) {
      errors.push(
        `variable "${variable.name}" (${variable.kind}) : la source "${source}" est de type ${kind}.`,
      );
    }
  }

  for (const name of Object.keys(bindings)) {
    if (!declared.has(name)) errors.push(`liaison "${name}" : aucune variable de ce nom.`);
  }

  return errors;
}

// Noms des templates d'avant le contrat. Un tel paquet s'installerait avec des
// options vides a la place des donnees (badges sans nom) : il est refuse.
export const LEGACY_NAMES: Record<string, string> = {
  firstName: "participant.firstName",
  lastName: "participant.lastName",
  organisationName: "participant.structure",
  participantPhotoDataUrl: "participant.photoDataUrl",
  categoryName: "category.name",
  categoryColor: "category.color",
  categoryNeutralBadge: "category.neutralBadge",
  isAnonymous: "category.anonymous",
  isAllAccess: "badge.allAccess",
  eventTitle: "event.title",
  eventDate: "event.date",
  eventLocation: "event.location",
  eventLogoDataUrl: "event.logoDataUrl",
  eventBannerDataUrl: "event.bannerDataUrl",
  badgeId: "badge.id",
  badgeVerifyUrl: "badge.verifyUrl",
  badgeQrCodeDataUrl: "badge.qrCodeDataUrl",
  securityInstructions: "event.securityInstructions",
};

// Les liaisons ne se choisissent plus : une cle du contrat se lie a sa donnee,
// toute autre variable est une option reglee par evenement.
export function computeBindings(variables: VariableDeclaration[]): Bindings {
  return Object.fromEntries(
    variables.map((variable) => [
      variable.name,
      Object.hasOwn(SOURCE_KINDS, variable.name) && SOURCE_KINDS[variable.name] === variable.kind
        ? variable.name
        : OPTION_BINDING,
    ]),
  );
}

export function checkBadgePackage(manifest: TemplateManifest): string[] {
  // checkContract ne controle rien hors d'une categorie a contrat : sans ce garde,
  // un paquet d'une autre categorie s'installerait sans verification.
  if (manifest.category !== "badge") {
    return [`catégorie "${manifest.category}" : seuls les templates de badge s'installent ici.`];
  }
  const legacy = manifest.variables
    .filter((variable) => Object.hasOwn(LEGACY_NAMES, variable.name))
    .map(
      (variable) =>
        `variable "${variable.name}" : ancien nom, réexporter le template depuis le studio (attendu "${LEGACY_NAMES[variable.name]}").`,
    );
  return [...legacy, ...checkContract(manifest)];
}
