---
route: /account/profile
title: Mon profil
audience: participant
sources:
  - src/app/account/profile/ProfileForm.tsx
  - src/app/account/profile/page.tsx
  - src/components/account/IdPhotoRules.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/DocumentPreview.tsx
  - src/components/ui/FileBox.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/ImageCropper.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:437551d985abf24e3901920494981aa839b42362b91fc321f1e06375f5da1067
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran regroupe les informations enregistrées sur votre compte, utilisées pour vos inscriptions et imprimées sur votre badge. Une photo et une pièce d'identité valides sont nécessaires pour vous inscrire à un évènement.

## Résumé du compte

Le cadre du haut rappelle votre **Email** (non modifiable) et le **Nom du compte**, puis l'état de votre profil :

- **Profil incomplet** : complétez tous les champs du formulaire pour pouvoir vous inscrire ;
- **En cours de vérification** : vos documents sont examinés par la plateforme, vous pourrez vous inscrire une fois le profil validé ;
- **Profil validé** : vous pouvez vous inscrire aux évènements ;
- **Documents refusés** : le motif et les précisions éventuelles sont affichés ; corrigez les documents puis enregistrez pour les soumettre à nouveau.

## Identité

- **Prénom** et **Nom** : obligatoires, ils figureront sur votre badge.
- **Structure (entreprise, école, organisation)** : obligatoire.

## Photo

Format JPEG, PNG ou WebP, 5 Mo maximum, au format photo d'identité 7:9. Un encadré rappelle les règles : visage de face et centré, fond blanc uni, tête nue (sauf motif religieux) et sans lunettes de soleil, photo nette, bien éclairée, récente, sans filtre ni retouche, minimum de pixels indiqué à l'écran.

- Choisissez un fichier : vous le recadrez dans la fenêtre « Recadrer la photo » avant l'envoi (« Envoi en cours… » s'affiche pendant le transfert).
- Une fois la photo enregistrée, un aperçu s'affiche et **Recadrer** permet de la recadrer à nouveau.

## Pièce d'identité

- **Type de pièce d'identité** : CNI (valeur par défaut), Passeport, Permis ou Autre.
- **Numéro de pièce** : obligatoire.
- Justificatif : fichier JPEG, PNG, WebP ou PDF (5 Mo maximum), avec aperçu une fois envoyé.

Toute modification de la photo ou de la pièce d'identité relance la vérification par la plateforme.

## Enregistrer

**Enregistrer** valide le formulaire (« Profil enregistré. »). Les champs laissés vides ne sont pas envoyés, ce qui permet un enregistrement partiel, mais le profil reste incomplet tant que tout n'est pas renseigné. Les boutons sont désactivés pendant l'envoi d'un fichier.

## Historique de mes soumissions

Si vous avez déjà soumis des documents, la liste indique pour chaque soumission son état (**Validé**, **Rejeté** ou **En attente**), le motif et les précisions en cas de rejet, et la date de soumission.

## Questions fréquentes

**Pourquoi ne puis-je pas modifier mon e-mail ?** Il identifie votre compte et n'est pas modifiable depuis cet écran.

**Mon profil a été refusé, que faire ?** Lisez le motif affiché, corrigez la photo ou la pièce, puis cliquez sur **Enregistrer** pour relancer la vérification.
