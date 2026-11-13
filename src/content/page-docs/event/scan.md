---
route: /event/[eventId]/scan
title: Scanner
audience: staff
access: scan.check-in
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/scan/page.tsx
  - src/components/event/QRScanner.tsx
  - src/components/event/QrCamera.tsx
  - src/components/event/ScannerFrame.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/StatusBadge.tsx
sourceHash: sha256:717820bef00e1584a8443fbe96006e132685dcd6b8b2cafe60bc38db5ec74cb8
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Le scanner contrôle l'accès à l'évènement en lisant le QR code des badges. Chaque scan est enregistré dans le journal de l'évènement.

## Lire un badge

Par défaut, la caméra est active (« Caméra active ») : présentez le QR code du badge devant elle. Si la caméra ne convient pas, **Saisie manuelle** permet de saisir l'**ID de badge ou contenu QR** puis de cliquer sur **Vérifier** ; **Activer la caméra** revient à la lecture par caméra.

## Le résultat

Un panneau affiche le résultat du dernier scan :
- **Accès autorisé** : l'inscription est approuvée. Le nom, la catégorie et le statut du participant s'affichent.
- **Accès refusé** : l'inscription existe mais n'est pas approuvée (le statut est affiché), ou le badge est inconnu (« Badge inconnu. »).
- **Badge d'un autre événement** : le badge appartient à un autre évènement.

Avant tout scan : « Aucun scan pour le moment. » En cas d'échec de la vérification : « Vérification impossible. Réessayez. »

## Historique de session

La liste **Historique de session** garde les 10 derniers scans de cette session, avec une pastille verte (autorisé) ou rouge (refusé), le nom ou le motif et l'heure. Elle est vidée au rechargement de la page. Sans scan : « Aucun scan. »
