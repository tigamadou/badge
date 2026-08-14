# Spec v4 — Affichage des détails d'un événement

> **Statut** : conception validée — 2026-08-07 — **à implémenter**
> **Type** : évolution de modèle + refonte d'affichage
> **Périmètre** : v4
> **Source** : `Todo.md` item 5

## Contexte et objectifs

« Revoir l'affichage des détails d'un événement » concerne **les trois vues** où un événement est présenté :

| Vue | Ce qui est affiché aujourd'hui |
|---|---|
| Publique `/e/[slug]` | Un bloc « Inscription en ligne » et la liste des catégories. L'en-tête d'événement vient de `PublicEventLayout` ; aucune description, aucun horaire. |
| Dashboard `/event/[eventId]` | Titre, lien public, compteurs, dix dernières inscriptions. **Ni la date, ni le lieu de l'événement que l'on gère.** |
| Liste org `/org/[orgId]/events` | Titre, date, lieu en colonnes ; le statut d'ouverture des inscriptions n'est pas visible. |

Le plafond est dans le modèle : `Event` ne porte que `title`, `slug`, `location`, `date`, `logo`, `registrationOpen`. Une refonte purement cosmétique ne peut donc rien enrichir. Cette spec lève d'abord ce plafond, puis harmonise les trois vues.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| Nouveaux champs | `description String? @db.Text` et `endDate DateTime?` sur `Event` | La page publique a besoin d'un contenu descriptif ; les événements sur plusieurs jours doivent pouvoir l'exprimer. Validé le 2026-08-07. |
| Nullabilité | Les deux champs sont optionnels | Aucune donnée à migrer (application hors production), et un événement mono-journée sans description reste valide. |
| Effet de `endDate` sur la logique métier | **Aucun** | `date` reste la date de référence : ID métier (`generate-id.ts`), badges, ouverture/clôture des inscriptions. `endDate` est purement informatif à ce stade. Contrainte de validation : `endDate >= date` si renseignée. |
| Format de la description | Texte brut, rendu avec préservation des sauts de ligne | Pas de Markdown ni d'éditeur riche : aucun besoin exprimé, et cela ouvrirait une surface d'injection à traiter. |
| Composant partagé | `EventInfoCard` (`src/components/event/`) | Le même bloc d'informations sert au dashboard et à la page publique, avec deux niveaux de détail. |
| Emails | Mise à jour des gabarits reprenant date/lieu pour afficher la période quand `endDate` est renseignée | Sinon un participant inscrit à un événement de trois jours ne verra qu'une date. |

## Architecture cible

### Modèle

```prisma
model Event {
  // …
  date        DateTime
  endDate     DateTime?   // v4 : informatif, >= date
  description String?     @db.Text
  // …
}
```

Pas de migration de données : `make db-push` + `make db-seed`. Le seed enrichit les événements de démonstration avec une description et une date de fin.

### `EventInfoCard`

Rendu commun : logo, titre, période (`date`, plus `endDate` si présente), lieu, description, catégories, statut des inscriptions. Deux variantes :

| Variante | Consommateur | Différence |
|---|---|---|
| `public` | `/e/[slug]` | Description mise en avant, catégories ouvertes uniquement, bloc contact |
| `staff` | `/event/[eventId]` | Statut d'ouverture des inscriptions, lien public copiable (`PublicLinkCard` conservé), lien vers les paramètres |

### Écrans

| Écran | Changement |
|---|---|
| `/e/[slug]` | En-tête complet via `EventInfoCard variant="public"` avant le bloc d'inscription |
| `/event/[eventId]` | `EventInfoCard variant="staff"` en tête, avant les compteurs ; le `select` Prisma récupère `date`, `endDate`, `location`, `description`, `logo` |
| `/org/[orgId]/events` | Colonne période (date ou plage) et pastille d'ouverture des inscriptions |
| Formulaire événement (`new` / `settings`) | Champs description et date de fin, avec validation `endDate >= date` côté serveur et client |
| Emails (`src/lib/mail.ts`) | Affichage de la période au lieu de la seule date |

Le tableau de bord de l'**opérateur** (branche `role === "OPERATOR"` de `/event/[eventId]`) reste volontairement minimal : scanner et compteur de scans.

## Tests

- **Unitaire** : formatage de période (date seule, plage, même jour) dans `src/lib/format-date.ts` ; validation `endDate >= date`.
- **Intégration** : `POST` / `PATCH` événement acceptent les deux champs et rejettent `endDate < date` (400).
- **E2E** : création d'un événement avec description et date de fin, puis vérification de leur affichage sur la page publique et sur le dashboard.

## Impacts documentation

- `docs/v4/README.md` — entrée de plan et état d'avancement.
- `docs/v4/architecture.md` — champs du modèle `Event`.
- `docs/v4/specs/2026-07-22-checklist-tests-manuels-navigateur.md` — pages concernées.

## Hors périmètre

- Gestion de plusieurs sessions ou créneaux horaires par événement.
- Éditeur riche pour la description.
- Toute logique métier adossée à `endDate` (clôture automatique des inscriptions, archivage).
