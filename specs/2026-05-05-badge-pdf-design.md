# Spec : Génération de Badge PDF — Investiture

**Date** : 5 mai 2026
**Statut** : En attente de validation

---

## 1. Objectif

Reproduire fidèlement le badge officiel de la cérémonie d'investiture (cf. `badge.jpeg`) sous forme de composant React, avec prévisualisation web et export PDF. Les badges ne sont générés que pour les inscriptions validées.

## 2. Stack technique

| Composant | Technologie |
|-----------|------------|
| Framework | Next.js (App Router) |
| PDF | `@react-pdf/renderer` |
| QR Code | `qrcode` (génération base64) |
| Langue | TypeScript |

## 3. Structure du badge

Format : **100 × 140 mm**, orientation portrait.

De haut en bas :

### 3.1 En-tête (fond blanc)
- **QR code** (coin supérieur gauche) — encode l'identifiant unique
- **Logo de l'événement** (coin supérieur droit) — uploadé par l'admin dans les paramètres

### 3.2 Informations de l'événement (fond blanc, centré)
- **Titre** de l'événement (gras, ex: "Cérémonie d'investiture du Président de la République")
- **Lieu + Date** (ex: "Porto-Novo, le 24 mai 2026")

### 3.3 Zone centrale (début du bandeau coloré)
- **Photo d'identité** (gauche) — fournie par l'inscrit
- **Nom complet** (droite, gras)
- **Structure** (droite, sous le nom)
- **Numéro d'identification** (vertical, côté gauche du bandeau)

### 3.4 Bandeau bas (fond coloré selon l'équipe)
- **Nom de l'équipe** en majuscules, grande taille (ex: "PROTOCOLE")
- La couleur de fond est définie dynamiquement par l'admin pour chaque équipe

## 4. Modèle de données

### 4.1 Événement (paramètres admin)

```typescript
interface Event {
  id: string;
  logo: string;        // URL du fichier uploadé
  title: string;       // "Cérémonie d'investiture du Président de la République"
  location: string;    // "Porto-Novo"
  date: string;        // "24 mai 2026"
}
```

### 4.2 Équipe (gérée dynamiquement par l'admin)

```typescript
interface Team {
  id: string;
  name: string;        // "PROTOCOLE"
  color: string;       // "#1a3a7c"
}
```

### 4.3 Inscription (données du badge)

```typescript
interface Registration {
  id: string;           // identifiant unique (voir section 5)
  photo: string;        // URL ou base64 de la photo uploadée
  fullName: string;     // "T. S. Gabin KAKPO"
  structure: string;    // "DGPEC"
  teamId: string;       // référence vers l'équipe
  status: "pending" | "approved" | "rejected";
}
```

### 4.4 Props du composant Badge

```typescript
interface BadgeProps {
  registration: Registration;
  team: Team;
  event: Event;
}
```

## 5. Génération de l'identifiant unique

Format hybride pour la sécurité :

```
[préfixe structuré] + [suffixe aléatoire]
```

- **Préfixe** : encode le type d'événement + la date (ex: `126` + `0524` = événement type 1, 24 mai 2026)
- **Suffixe** : 6 caractères alphanumériques générés via `crypto.randomBytes()` ou équivalent côté client

Exemple : `1260524A7F3B2`

Le QR code encode cet identifiant. Lors du scan, il est vérifié sur une page dédiée pour contrôler l'accès.

## 6. Fonctionnalités de rendu

### 6.1 Prévisualisation
- Composant `<PDFViewer>` de `@react-pdf/renderer`
- Accessible uniquement pour les inscriptions avec `status === "approved"`
- Affichage intégré dans l'interface d'administration

### 6.2 Téléchargement PDF
- Composant `<PDFDownloadLink>` de `@react-pdf/renderer`
- Nom du fichier : `badge-{fullName}-{id}.pdf`
- Disponible uniquement pour les inscriptions validées

## 7. Paramètres de l'événement (admin)

L'administrateur peut configurer via une interface dédiée :

| Paramètre | Type | Description |
|-----------|------|-------------|
| Logo | Upload fichier | Image affichée en haut du badge |
| Titre | Texte | Titre officiel de l'événement |
| Lieu | Texte | Ville / lieu de l'événement |
| Date | Texte | Date formatée de l'événement |
| Équipes | Liste dynamique | Nom + couleur pour chaque équipe |

Les équipes peuvent être ajoutées, modifiées ou supprimées. Chaque équipe définit un nom et une couleur qui détermine le bandeau bas du badge.

## 8. Contraintes

- Le rendu PDF doit être identique à la prévisualisation web
- Les polices utilisées doivent être embarquées dans le PDF pour un rendu fidèle à l'impression
- Le badge doit être imprimable sans perte de qualité à 300 DPI
- La photo doit être redimensionnée/recadrée pour s'adapter à la zone prévue
- Le QR code doit rester scannable une fois imprimé (taille minimale ~25mm)

## 9. Arborescence prévue

```
src/
  components/
    badge/
      BadgeDocument.tsx      # Composant @react-pdf/renderer (le badge complet)
      BadgePreview.tsx        # Wrapper avec <PDFViewer>
      BadgeDownload.tsx       # Wrapper avec <PDFDownloadLink>
  lib/
    generate-id.ts           # Génération de l'identifiant hybride
    qrcode.ts                # Génération QR code en base64
  types/
    index.ts                 # Interfaces Event, Team, Registration, BadgeProps
```

## 10. Référence visuelle

Le fichier `badge.jpeg` à la racine du projet sert de référence pour la mise en page exacte du badge.
