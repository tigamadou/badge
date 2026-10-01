# Spec v4 — Catalogue et installation de templates de badge

> **Statut** : conception validée — 2026-08-11 — **à implémenter**
> **Type** : nouveau modèle de données + nouvelles routes + écrans plateforme
> **Périmètre** : v4
> **Dépend de** : [`2026-08-11-10-…format-et-moteur…`](2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md)
> **Deuxième de trois specs** : [10] format et moteur → **[11] catalogue et installation** → [12] bascule et retrait du registre code

## Contexte et objectifs

La spec 10 fournit un moteur capable de rendre un badge à partir d'un manifeste et d'un
résolveur de ressources, mais aucun paquet ne peut encore entrer dans l'application.
Cette spec ouvre la porte : le staff plateforme **téléverse une archive** depuis son
espace, elle est vérifiée, extraite, prévisualisée, stockée, puis proposée au même titre
que les templates livrés dans le sélecteur existant.

L'expérience visée est celle de l'installation d'un thème : on dépose une archive, on
voit à quoi elle ressemble avant de valider, on retrouve ses templates dans un catalogue,
on peut en retirer un. À la fin de cette spec, on ajoute un modèle de badge **sans
déployer**.

Le registre code reste en place et continue de servir les deux templates historiques :
son retrait fait l'objet de la spec 12.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| Qui installe | **Staff plateforme uniquement**, template global | Arbitrage du 2026-08-11. Une seule table, pas de propriétaire, pas de filtrage : la cascade `Event → Org → Platform` existante suffit. |
| Mise à jour d'un template | **Interdite.** Chaque installation crée une **nouvelle ligne versionnée** | Arbitrage du 2026-08-11 : un événement ne doit jamais voir son badge changer sous ses pieds. Une ligne immuable rend le figement structurel. |
| Identifiant stocké | Le **cuid** de la ligne installée | Un cuid ne désigne qu'une version, pour toujours. Évite d'inventer une syntaxe `famille@version` et son parsing. Les ids du registre code (`default-v1`) restent des chaînes distinctes, sans collision possible. |
| Archivage | **Soft delete** : la ligne, son layout **et ses ressources** restent | Convention du projet, et surtout : un template archivé doit rester **résolvable** pour les événements qui le référencent, sinon leurs badges changeraient. Il cesse simplement d'être proposé. |
| Aperçu | **Généré à l'installation**, stocké via `src/lib/storage.ts` | Un aperçu fourni par l'installateur pourrait mentir sur le rendu réel — le piège à éviter dans un sélecteur. Le générer prouve en outre que le paquet s'imprime. |
| Résolution | `resolveTemplate(id)` **asynchrone** : registre code d'abord, base ensuite, repli sur le défaut | Une seule porte d'entrée pour les six consommateurs actuels, ce qui rendra le retrait du registre (spec 12) invisible pour eux. |
| Stockage des ressources | Extraites à l'installation sous `badge-templates/<templateId>/…` via `src/lib/storage.ts` | Le rendu doit lire une ressource sans rouvrir l'archive à chaque impression. L'abstraction de stockage existante prépare le passage à S3. |

### Alternatives écartées

| Alternative | Statut | Raison |
|---|---|---|
| Mise à jour en place d'un template installé | Non retenue | Changerait l'aspect des badges d'événements en cours sans prévenir. C'est le risque que le versionnement figé élimine. |
| Identifiant lisible `famille@version` | Non retenue | Impose un parsing et une gestion de collision avec les ids du registre, pour un gain cosmétique. |
| Installation ouverte aux organisations | Non retenue | Écartée le 2026-08-11 : imposerait quotas, modération et gestion du risque qu'un client casse ses propres badges. |
| Archivage refusé si le template est utilisé | Non retenue | Bloquerait le staff sur de vieux événements archivés conservant la référence. Le soft delete résout le besoin sans impasse. |
| Conserver l'archive et l'ouvrir à chaque rendu | Non retenue | Coût à chaque impression, et dépendance à un format d'archive au cœur du chemin de rendu. L'extraction à l'installation isole le ZIP de la production de badges. |

## Architecture cible

### Modèle

```prisma
// v4 (spec 11) : une ligne = une VERSION FIGEE d'un template. Jamais de update
// sur layout : reinstaller cree une nouvelle ligne. C'est ce qui garantit qu'un
// evenement ne voit jamais son badge changer.
model InstalledBadgeTemplate {
  id            String    @id @default(cuid())
  family        String
  version       Int
  label         String
  description   String    @db.Text
  pages         Int
  pageWidthMm   Float
  pageHeightMm  Float
  layout        Json
  assetPrefix   String
  previewPath   String?
  formatVersion Int
  installedById String
  archived      Boolean   @default(false)
  archivedAt    DateTime?
  createdAt     DateTime  @default(now())

  @@unique([family, version])
  @@index([archived])
}
```

`installedById` est un identifiant nu, **sans relation Prisma**, comme
`ProfileSubmission.reviewedById` (`schema.prisma:318`) : cela évite d'ajouter une
back-relation sur `User` pour une donnée d'audit.

`family` regroupe les versions successives d'un même modèle et sert à l'affichage et à
la future migration. `assetPrefix` est la racine de stockage des ressources extraites.
C'est `id` — le cuid — que stockent `Event.badgeTemplateId`,
`Organization.badgeTemplateId` et `PlatformSettings.badgeTemplateId`. Ces trois colonnes
restent des `String` : **aucune modification de la cascade**,
`resolveBadgeTemplateId` (`src/lib/settings.ts:121`) est inchangé.

### Ouverture de l'archive

`src/lib/badge-templates/package-reader.ts` est le **seul** module autorisé à ouvrir une
archive. Il rend soit un paquet vérifié (manifeste analysé plus liste des ressources),
soit une liste d'erreurs. Il applique, avant toute extraction :

| Contrôle | Valeur | Raison |
|---|---|---|
| Taille de l'archive | 10 Mo | Borne d'entrée, cohérente avec un paquet contenant quelques images. |
| Taille totale décompressée | 30 Mo | Protège de la bombe de décompression : une archive minuscule qui gonfle à plusieurs gigaoctets. |
| Nombre d'entrées | 50 | Même objectif, sur l'axe du nombre de fichiers. |
| Chemins | Relatifs, sans `..`, sans racine absolue, sans lien symbolique | Empêche l'écriture hors du répertoire cible (*zip slip*). |
| Emplacements | `manifest.json`, `assets/*`, `fonts/*` exclusivement | Toute autre entrée fait échouer : une archive dont on ignore une partie du contenu est une archive dont on ne maîtrise pas le comportement. |
| Images | **JPEG et PNG**, 5 Mo par fichier | `@react-pdf/image` ne reconnaît que ces formats ; le plafond reprend le garde-fou projet. Le type est vérifié sur les **octets d'en-tête**, jamais sur l'extension. |
| Polices | TTF et OTF, 2 Mo par fichier | Formats acceptés par `Font.register`. |

L'extraction n'a lieu qu'après validation complète du manifeste et de ses références :
une archive refusée ne laisse aucun fichier derrière elle.

### Résolution unifiée

```ts
// src/lib/badge-templates/resolve.ts
export async function resolveTemplate(id: string): Promise<ResolvedTemplate>;
export async function listAvailableTemplates(): Promise<TemplateSummary[]>;
```

`resolveTemplate` cherche l'id dans le registre code, puis dans
`InstalledBadgeTemplate` (**y compris archivé** — c'est le point qui fige les badges
existants), et retombe sur `DEFAULT_TEMPLATE_ID` si rien ne correspond, en journalisant
l'anomalie comme le fait déjà `badges/[badgeId]/route.tsx:64`. Pour une ligne installée,
elle construit le template via `buildDeclarativeTemplate(manifest, assetResolver)`, le
résolveur étant adossé à `assetPrefix` et à `src/lib/storage.ts`.

`listAvailableTemplates` ne renvoie que ce qui est **proposable** : le registre code
plus les lignes non archivées, une seule version par famille (la plus récente). C'est ce
que consomment les trois écrans de réglage.

Les six consommateurs actuels (`platform/settings/badge`, `org/settings/badge`,
`event/settings/badge`, leurs trois routes API, et `badges/[badgeId]/route.tsx`)
basculent sur ces deux fonctions. Les trois routes de réglage valident désormais l'id
soumis via `resolveTemplate`, ce qui autorise un cuid installé là où seul un id du
registre passait.

### Installation

`POST /api/platform/badge-templates` — corps : l'archive en `multipart/form-data`. La
garde reprend exactement celle de `src/app/api/platform/settings/badge/route.ts:22` :
session obligatoire (401 sinon) puis `requireStaff(session.user.id, "STAFF_ADMIN")`,
dont l'`AuthError` est traduite en code et statut HTTP.

La route enchaîne, et s'arrête à la première erreur :

1. `package-reader` — contrôles d'archive puis `parseManifest` ; refus 400 avec la liste
   des erreurs ;
2. refus 400 si `family` collisionne avec un id du registre code ;
3. calcul de la version : `max(version) + 1` pour la `family`, ou 1 ;
4. extraction des ressources sous `badge-templates/<cuid>/` ;
5. **rendu d'épreuve** avec un contexte fictif — si le rendu échoue, refus 400 **et
   suppression des ressources extraites** : un paquet qui ne s'imprime pas n'entre pas au
   catalogue et ne laisse rien derrière lui ;
6. écriture de l'aperçu ;
7. création de la ligne ;
8. `logActivity({ type: "BADGE_TEMPLATE_INSTALLED", … })`.

L'ordre importe : la ligne n'est créée qu'après une preuve de rendu réussie, de sorte
qu'aucune entrée du catalogue ne peut être irrécupérable.

`PATCH /api/platform/badge-templates/[id]` n'accepte qu'un seul changement : `archived`.
**Aucune route ne modifie `layout` ni les ressources** — l'immuabilité est appliquée au
niveau de l'API, pas seulement par convention.

### Contexte fictif

Le rendu d'épreuve et l'aperçu partagent un contexte de démonstration figé, exporté par
`src/lib/badge-templates/declarative/sample-context.ts` : un participant fictif, une
catégorie colorée, un événement daté, un QR code de démonstration. Il est **constant**,
sans date du jour ni aléa, pour que deux installations du même paquet produisent le même
aperçu.

### Écrans

`/platform/badge-templates` : catalogue des familles avec leur version courante, leur
aperçu et leur état ; installation par téléversement, avec affichage des erreurs de
validation puis de l'aperçu obtenu **avant confirmation** ; action d'archivage.

Le `BadgeTemplatePicker` existant (`src/components/admin/BadgeTemplatePicker.tsx`) est
**inchangé** : son type `TemplateSummary` décrit déjà ce dont il a besoin. Seules les
trois pages qui l'alimentent passent de `listTemplates()` à
`await listAvailableTemplates()`, et le `previewSrc` d'un template installé pointe vers
son aperçu stocké.

## Sécurité

L'archive est une entrée utilisateur qui devient du contenu rendu. Trois lignes de
défense, dans cet ordre :

1. **L'archive** — bornes de taille, de nombre d'entrées et de taux de décompression ;
   chemins contraints ; emplacements en liste blanche ; types vérifiés sur les octets.
2. **Le manifeste** — validation de la spec 10 : liste blanche de sources, bornes
   géométriques, références de ressources et de polices vérifiées.
3. **Le rendu d'épreuve** — un paquet qui ne produit pas de PDF n'entre pas.

Aucune de ces étapes n'exécute quoi que ce soit provenant du paquet : il n'y a pas de
code à exécuter, par construction du format.

L'installation est une action sensible, donc auditée. Deux nouveaux `ActivityType` :
`BADGE_TEMPLATE_INSTALLED` et `BADGE_TEMPLATE_ARCHIVED`.

## Tests

Couverture à **100 %** exigée sur `src/lib/**` et `src/app/api/**`.

- `package-reader.test.ts` : archive valide ; archive trop lourde ; taux de
  décompression excessif ; trop d'entrées ; chemin `../` ; entrée hors des trois
  emplacements ; image WebP refusée ; image dont l'extension ment sur le contenu ;
  police d'un format non supporté ; ressource déclarée au manifeste mais absente de
  l'archive.
- `resolve.test.ts` : id du registre ; cuid installé actif ; cuid installé **archivé**
  (doit résoudre) ; id inconnu (repli sur le défaut, avec journalisation) ;
  `listAvailableTemplates` n'expose ni les archivés ni les versions anciennes.
- Route d'installation, contrat minimal du projet : golden path 201 ; 401 sans session ;
  403 pour un rôle insuffisant ; 400 sur archive invalide ; 400 sur manifeste invalide ;
  400 sur échec de rendu **avec vérification que rien n'a été laissé en stockage** ; 400
  sur `family` en collision ; incrément de version sur réinstallation ; assertion
  `logActivity`.
- Route d'archivage : golden path ; 404 sur id inconnu ; refus de toute tentative de
  modification du `layout` ; ressources conservées après archivage ; assertion
  `logActivity`.
- Non-régression : un événement référençant un template archivé rend toujours le même
  badge.
- E2E : le staff installe une archive, la voit apparaître au catalogue avec son aperçu,
  puis un créateur d'événement la sélectionne sur l'écran de paramètres de son événement
  et le badge produit utilise bien ce template.

## Documentation impactée

- `docs/v4/features/templates-badges.md` (créée en spec 10) — installation,
  versionnement, archivage, contrôles appliqués à l'archive.
- `docs/v4/architecture.md` — le catalogue et la résolution unifiée.
- `docs/v4/api/` — les deux nouvelles routes plateforme.
