---
route: /account/profile/complete
title: Compléter votre profil
audience: participant
sources:
  - src/app/account/profile/ProfileForm.tsx
  - src/app/account/profile/complete/page.tsx
  - src/components/account/IdPhotoRules.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/DocumentPreview.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/ImageCropper.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:9043cf13a57dabf99a699d5ca7fa30eb419c34bca76112ba95fc08bef2dcbeac
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Avant de vous inscrire à un évènement, la plateforme a besoin d'informations obligatoires : identité, structure, photo et pièce d'identité. Elles servent uniquement à vos badges. Cet écran présente le formulaire de profil avec ce message d'introduction.

## Le formulaire

Il est identique à celui de l'écran **Mon profil** :

- **Identité** : **Prénom**, **Nom** et **Structure (entreprise, école, organisation)**, tous obligatoires.
- **Photo** : JPEG, PNG ou WebP, 5 Mo maximum, format photo d'identité 7:9, avec rappel des règles et recadrage dans « Recadrer la photo ».
- **Pièce d'identité** : **Type de pièce d'identité** (CNI par défaut, Passeport, Permis, Autre), **Numéro de pièce** et justificatif (JPEG, PNG, WebP ou PDF, 5 Mo maximum).

Toute modification de la photo ou de la pièce d'identité relance la vérification par la plateforme.

## Enregistrer

**Enregistrer** sauvegarde le profil puis vous redirige vers la page d'où vous veniez (par exemple l'inscription que vous aviez commencée). Si aucune destination valide n'est fournie, vous revenez à **Mes inscriptions**. Contrairement à l'écran **Mon profil**, aucun message de confirmation n'est affiché : la page d'arrivée montre le résultat.

## Questions fréquentes

**Puis-je enregistrer sans tout remplir ?** Oui, les champs vides sont ignorés, mais votre profil reste incomplet et l'inscription à un évènement reste bloquée.
