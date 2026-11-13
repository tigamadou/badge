---
route: /org/[orgId]
title: Tableau de bord
audience: organisateur
access: org.read
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/page.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/StatCard.tsx
  - src/components/ui/Timeline.tsx
sourceHash: sha256:889762f0001ecd77b6aa2e25011cbc44b647424d5a045233d5d515326af6457b
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Le tableau de bord est la page d'accueil de votre organisation. Il donne une vue d'ensemble : nombre d'évènements, inscriptions du mois, derniers évènements et activité récente. Les blocs affichés dépendent de vos droits : un bloc dont vous n'avez pas le droit n'apparaît pas.

:::permission org.events.list
## Les indicateurs

- **Événements actifs** : nombre d'évènements non archivés de l'organisation.
- **Événements archivés** : nombre d'évènements archivés.
- **Inscriptions ce mois** : inscriptions créées depuis le début du mois en cours, tous évènements de l'organisation confondus.
:::

:::permission billing.subscription.read
## Le quota d'évènements

Un quatrième indicateur, **Quota événements**, compare le nombre d'évènements actifs à la limite de votre plan (par exemple « 3 / 10 »). Il affiche « — » si le plan n'a pas de limite d'évènements. Lorsque l'usage dépasse 80 % de la limite, un message d'avertissement apparaît en haut de page : « Un quota dépasse 80 % ». Contactez alors le support si vous prévoyez d'aller plus loin.
:::

## Derniers événements

La carte **Derniers événements** liste les cinq évènements non archivés les plus récents, avec leur date et la mention « inscriptions ouvertes » lorsque c'est le cas. Cliquer sur un évènement ouvre son espace. Le lien **Tout voir** mène à la liste complète des évènements. S'il n'y en a aucun, l'écran indique « Aucun événement ».

:::permission org.activity.read
## Activité récente

La carte **Activité récente** présente les dix dernières actions enregistrées pour l'organisation, avec leur date et heure. Une action effectuée par le staff de la plateforme est précédée de « Staff · ». Pour le détail complet, ouvrez le journal d'activité.
:::
