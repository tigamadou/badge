---
route: /org/[orgId]/settings
title: Paramètres de l'organisation
audience: organisateur
access: org.update
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/settings/SettingsClient.tsx
  - src/app/org/[orgId]/settings/page.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:9f4ce8c986c4c76bf030bccb3ab4e6605331609a1ef7b22e604ad8f37eb55e72
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran regroupe l'identité, l'adresse et le contact public de votre organisation. Le bouton **Modèle de badge par défaut** en haut mène au choix du modèle de badge de l'organisation.

## Identité

- **Nom**.
- **Raison sociale**.
- **Slug** : non modifiable ici, il est géré par le staff uniquement.
- **Logo** : déposez une image (JPEG, PNG ou WebP, 5 Mo maximum) ou cliquez pour en choisir une. Une fois envoyé, **Retirer** supprime le logo de la fiche.

:::permission org.upload
L'envoi du logo exige le droit de téléverser les fichiers de l'organisation.
:::

## Adresse

**Ligne 1**, **Ligne 2**, **Code postal**, **Ville** et **Pays**.

## Administratif

**Numéro fiscal / SIRET** et **Site web** (par exemple https://exemple.fr).

## Contact public

**E-mail de contact** et **Téléphone**.

## Enregistrer

Les modifications ne sont prises en compte qu'au clic sur **Enregistrer** (« Paramètres enregistrés. »). **Annuler** rétablit les valeurs d'origine. Un champ facultatif vidé est effacé.
