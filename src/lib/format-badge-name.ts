const MAX_BADGE_NAME_LENGTH = 20;
const MAX_BADGE_STRUCTURE_LENGTH = 28;

export function formatBadgeName(firstName: string, lastName: string): string {
  const upperLastName = lastName.toUpperCase();
  const parts = firstName.trim().split(" ").filter(Boolean);

  if (parts.length === 0) {
    return upperLastName.substring(0, MAX_BADGE_NAME_LENGTH);
  }

  const buildName = (nameParts: string[]) =>
    `${nameParts.join(" ")} ${upperLastName}`;

  if (buildName(parts).length <= MAX_BADGE_NAME_LENGTH) {
    return buildName(parts);
  }

  // Progressively shorten first names from right to left
  const shortened = [...parts];
  for (let i = shortened.length - 1; i >= 0; i--) {
    shortened[i] = `${shortened[i][0]}.`;
    if (buildName(shortened).length <= MAX_BADGE_NAME_LENGTH) {
      return buildName(shortened);
    }
  }

  // All first names abbreviated but still too long — drop initials from right.
  // La boucle verifie l'etat "initiale unique + nom" a sa derniere iteration
  // (length passe a 1) : inutile de le re-tester ensuite.
  while (shortened.length > 1) {
    shortened.pop();
    if (buildName(shortened).length <= MAX_BADGE_NAME_LENGTH) {
      return buildName(shortened);
    }
  }

  // lastName alone
  if (upperLastName.length <= MAX_BADGE_NAME_LENGTH) {
    return upperLastName;
  }

  // Last resort: truncate lastName
  return upperLastName.substring(0, MAX_BADGE_NAME_LENGTH);
}

export function formatBadgeStructure(structure: string): string {
  if (structure.length <= MAX_BADGE_STRUCTURE_LENGTH) {
    return structure;
  }
  return structure.substring(0, MAX_BADGE_STRUCTURE_LENGTH) + "...";
}
