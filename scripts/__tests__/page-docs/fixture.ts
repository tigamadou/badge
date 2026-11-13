import { makeRepo, writeFile } from "./helpers";
import { stampDocs } from "../../page-docs/stamp";

export const PAGE = "src/app/org/[orgId]/events/new/page.tsx";
export const DOC = "src/content/page-docs/org/events/new.md";
export const TODAY = "2026-11-13";

export const BODY = `## À quoi sert cet écran

Créer un évènement.

:::permission org.events.create
Section réservée.
:::
`;

export function docText(extra = ""): string {
  return `---
route: /org/[orgId]/events/new
title: Créer un évènement
audience: organisateur
${extra}---

${BODY}`;
}

/** Dépôt factice : une page `org/events/new` avec un composant, sa doc tamponnée et ses manifestes. */
export function repoWithStampedDoc(): string {
  const root = makeRepo({
    [PAGE]: `import Form from "@/components/EventForm";`,
    "src/components/EventForm.tsx": "export default function EventForm() { return null; }",
    "src/app/org/[orgId]/page.tsx": "",
    [DOC]: docText(),
    "src/content/page-docs/org/index.md": docText().replace("/org/[orgId]/events/new", "/org/[orgId]").replace("Créer un évènement", "Accueil"),
  });
  stampDocs(root, ["org/events/new", "org/index"], TODAY);
  return root;
}

export { writeFile };
