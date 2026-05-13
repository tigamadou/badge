const MAX_BADGE_NAME_LENGTH = 20;
const MAX_BADGE_STRUCTURE_LENGTH = 28;

export function formatBadgeName(firstName: string, lastName: string): string {
  const upperLastName = lastName.toUpperCase();
  const parts = firstName.split(" ").filter(Boolean);

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

  // All first names are shortened but still too long — return as-is (best effort)
  return buildName(shortened);
}

export function formatBadgeStructure(structure: string): string {
  if (structure.length <= MAX_BADGE_STRUCTURE_LENGTH) {
    return structure;
  }
  return structure.substring(0, MAX_BADGE_STRUCTURE_LENGTH) + "...";
}
