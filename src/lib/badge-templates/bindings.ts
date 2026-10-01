import type { VariableDeclaration, VariableKind } from "@tigamadou/pdf-engine";

// Le vocabulaire du domaine badge. Il vivait dans le moteur (declarative/sources.ts) ;
// le moteur v2 ne connait plus aucun nom metier, alors il remonte ici — hors du
// dossier copie, dans le code dont l'application est proprietaire.
export const SOURCE_KINDS: Record<string, VariableKind> = {
  "participant.firstName": "text",
  "participant.lastName": "text",
  "participant.structure": "text",
  "participant.photoDataUrl": "image",
  "category.name": "text",
  "category.color": "color",
  "category.neutralBadge": "boolean",
  "category.anonymous": "boolean",
  "event.title": "text",
  "event.date": "date",
  "event.location": "text",
  "event.logoDataUrl": "image",
  "event.securityInstructions": "list",
  "badge.id": "text",
  "badge.verifyUrl": "text",
  "badge.qrCodeDataUrl": "image",
  "badge.allAccess": "boolean",
};

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

// Pre-remplissage de l'ecran d'installation : l'identite, et rien de plus. Une
// heuristique sur les noms proches (« prenom » -> participant.firstName) produirait
// des suggestions fausses qu'on validerait d'un clic — pire qu'une case vide.
export function suggestBindings(variables: VariableDeclaration[]): Bindings {
  const suggested: Bindings = {};
  for (const variable of variables) {
    if (SOURCE_KINDS[variable.name] === variable.kind) suggested[variable.name] = variable.name;
  }
  return suggested;
}
