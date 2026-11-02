// Garde-fou des tests : Vitest ne tourne que sur une base dont le nom finit par
// `_test`, jamais sur une base de dev (que la remise a zero des tests viderait).
export function assertTestDatabase(url: string | undefined): void {
  let name = "";
  try {
    name = new URL(url ?? "").pathname.replace(/^\//, "");
  } catch {
    // URL absente ou invalide : refusee ci-dessous.
  }
  if (!name.endsWith("_test")) {
    throw new Error(
      `Tests refusés : la base « ${name || url || "(non définie)"} » n'est pas une base de test (nom attendu en _test). Lancez-les avec \`make test\`.`,
    );
  }
}
