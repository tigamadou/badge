import type { PageDocEntry, PageDocIndexEntry } from "@/content/page-docs/types";

const entry = (e: Omit<PageDocEntry, "space" | "audience" | "updatedAt"> & Partial<PageDocEntry>): PageDocEntry => ({
  space: e.id.split("/")[0] as PageDocEntry["space"],
  audience: "organisateur",
  updatedAt: "2026-11-20",
  ...e,
});

export const FIXTURE_DOCS: PageDocEntry[] = [
  entry({
    id: "account/index",
    route: "/account",
    title: "Mon compte",
    audience: "participant",
    body: "## À quoi sert cet écran\n\nVoir vos inscriptions.\n",
  }),
  entry({
    id: "event/index",
    route: "/event/[eventId]",
    title: "Vue d'ensemble de l'évènement",
    body: "Bienvenue sur l'évènement.\n\n:::permission org.update\nSection d'organisation.\n:::\n\n:::permission event.read.aggregated\nChiffres clés.\n:::\n",
  }),
  entry({
    id: "event/print/detail",
    route: "/event/[eventId]/print/[requestId]",
    title: "Détail d'une demande d'impression",
    body: "Détail.\n",
  }),
  entry({
    id: "event/print/onsite",
    route: "/event/[eventId]/print/onsite",
    title: "Impression sur place",
    body: "Sur place.\n",
  }),
  entry({
    id: "org/events",
    route: "/org/[orgId]/events",
    title: "Évènements",
    access: "org.events.list",
    body: "Liste des évènements de l'organisation. Filtrez par statut.\n",
  }),
  entry({
    id: "org/events/new",
    route: "/org/[orgId]/events/new",
    title: "Créer un évènement",
    access: "org.events.create",
    body: ":::permission org.update\nPhrase réservée.\n:::\n\nCréez un évènement.\n",
  }),
  entry({
    id: "org/index",
    route: "/org/[orgId]",
    title: "Accueil de l'organisation",
    body: "## À quoi sert cet écran\n\nVue d'ensemble de **votre organisation**.\n\n:::permission org.update\n## Modifier\n\nSecret des propriétaires.\n:::\n",
  }),
  entry({
    id: "platform/organizations",
    route: "/platform/organizations",
    title: "Organisations",
    audience: "staff",
    access: "organizations.read",
    body: "# Organisations\n\n| a | b |\n\nTexte [lien](/x).\n",
  }),
  entry({
    id: "platform/vide",
    route: "/platform/vide",
    title: "Sans texte",
    audience: "staff",
    body: "# Seulement un titre\n",
  }),
];

export const FIXTURE_INDEX: PageDocIndexEntry[] = FIXTURE_DOCS.map((d) => {
  const { body, ...rest } = d;
  void body;
  return rest;
});
