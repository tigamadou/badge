---
route: /event/[eventId]/settings
title: Paramètres de l'évènement
audience: organisateur
access: event.settings.update
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/settings/page.tsx
  - src/components/event/BadgeOptionsFields.tsx
  - src/components/event/EventSettingsForm.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/ImageCropper.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:d7d063c3743360b96d69d25a7a5bb2e6136c1105d455206ed501978dcffa76a2
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran regroupe les informations de l'évènement, ses images, ses consignes de sécurité, l'ouverture des inscriptions et les contacts. Le bouton **Modèle de badge de l'événement** en haut ouvre le choix du modèle de badge.

Sans le droit de modifier l'évènement, les champs de la carte **Informations** sont en lecture seule (« Vous pouvez consulter ces informations, pas les modifier. »).

## Informations

- **Titre** (obligatoire) et **Lieu** ;
- **Date** (obligatoire) et **Date de fin (optionnelle)** : la date de fin doit être postérieure ou égale à la date de l'évènement (« La date de fin doit être postérieure ou égale à la date de l'événement. ») ;
- **Description (optionnelle)** ;
- **Logo** et **Bannière** : déposez une image ou cliquez. Un indice rappelle le format attendu par le modèle de badge (rapport largeur/hauteur, exemple de dimensions, minimum) ; les formats acceptés sont JPEG, PNG ou WebP, 5 Mo maximum. Si l'image ne respecte pas le cadre du modèle (ou si elle est en WebP), un outil de recadrage s'ouvre avant l'envoi ; l'original est conservé pour recadrer plus tard. Une fois l'image envoyée, **Recadrer** la reprend et **Retirer** la supprime. Une image non conforme est signalée « À recadrer : … » ;
- **Consignes de sécurité (optionnelles)** : une consigne par ligne, 30 au plus, 500 caractères chacune ; elles sont imprimées sur les badges dont le modèle affiche les consignes ;
- **Inscriptions ouvertes** : interrupteur d'ouverture des inscriptions. Il est grisé si vous n'avez pas le droit d'ouvrir ou fermer les inscriptions. Lorsqu'elles sont fermées, la page d'inscription publique affiche un message de fermeture ;
- le **Slug** de l'évènement est affiché pour information : il n'est modifiable que par le staff.

Le bouton **Enregistrer** valide l'ensemble (« Événement mis à jour. »).

:::permission event.update
## Options du badge

Lorsque le modèle de badge de l'évènement propose des réglages, la carte **Options du badge** les présente, selon leur type : case à cocher, texte, couleur, date, liste (une ligne par élément) ou image (JPEG, PNG ou WebP, 5 Mo maximum). La mention **À renseigner** signale une option encore vide. Elles sont enregistrées avec le bouton **Enregistrer** de la carte Informations ; une valeur refusée affiche « Options du badge : valeur refusée (texte de 500 caractères au plus, 30 lignes au plus). »
:::

## Contact (surcharges)

Deux champs, **E-mail de contact** et **Téléphone de contact**, remplacent pour cet évènement les contacts de l'organisation. Laissés vides, ils héritent du niveau organisation : la valeur héritée s'affiche en indication dans le champ (« Cascade : … »). Le bouton **Enregistrer** de cette carte valide les contacts (« Paramètres enregistrés. »). Les paramètres d'envoi d'e-mails ne se règlent pas ici : ils sont gérés au niveau de la plateforme.
