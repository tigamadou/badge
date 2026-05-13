const MAX_BADGE_NAME_LENGTH = 18;
const MAX_BADGE_STRUCTURE_LENGTH = 30;

export function formatBadgeName(firstName: string, lastName: string): string {
  const upperLastName = lastName.toUpperCase();
  const fullName = `${firstName} ${upperLastName}`;

  if (fullName.length <= MAX_BADGE_NAME_LENGTH) {
    return fullName;
  }

  // Space + lastName must always be visible
  const availableForFirstName = MAX_BADGE_NAME_LENGTH - 1 - upperLastName.length;

  if (availableForFirstName >= 2) {
    // Truncate firstName and add "."
    return `${firstName.substring(0, availableForFirstName - 1)}. ${upperLastName}`;
  }

  // Edge case: lastName alone is too long or leaves no room for firstName
  return upperLastName.substring(0, MAX_BADGE_NAME_LENGTH);
}

export function formatBadgeStructure(structure: string): string {
  if (structure.length <= MAX_BADGE_STRUCTURE_LENGTH) {
    return structure;
  }
  return structure.substring(0, MAX_BADGE_STRUCTURE_LENGTH - 1) + ".";
}
