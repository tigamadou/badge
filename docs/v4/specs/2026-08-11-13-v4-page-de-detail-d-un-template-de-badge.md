# Spec v4 — Page de détail d'un template de badge

> **Statut** : conception validée — 2026-08-11 — **à implémenter**
> **Type** : nouvel écran staff (lecture seule)
> **Périmètre** : v4
> **Dépend de** : [`2026-08-11-11-…catalogue-et-installation…`](2026-08-11-11-v4-catalogue-et-installation-de-templates.md) et [`2026-08-11-12-…bascule…`](2026-08-11-12-v4-bascule-des-templates-livres-et-retrait-du-registre.md)
> **Source** : demande utilisateur du 2026-08-11

## Contexte et objectifs

Le catalogue `/platform/badge-templates` liste les templates installés — libellé, famille,
version, dimensions, état — mais **n'affiche aucun aperçu**, alors que le PDF d'épreuve
existe en base (`previewPath`) depuis l'installation. Aujourd'hui, la seule façon de voir à
quoi ressemble un modèle est d'ouvrir un écran de réglage de badge, où le sélecteur le
rend parmi les autres.

Trois informations sont par ailleurs inaccessibles :

- **qui utilise ce template** — impossible de savoir, avant d'archiver, si des événements
  en dépendent ;
- **les versions successives** d'une même famille, alors que le versionnement figé est au
  cœur du modèle ;
- **le manifeste** lui-même, ce qui interdit de repartir d'un modèle existant pour en
  produire une variante.

Cette spec ajoute un écran de détail qui répond à ces trois manques et corrige l'absence
d'aperçu au catalogue.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| Accès | **Tout staff**, comme la liste | La page est en lecture seule ; le layout `/platform` porte déjà la garde. Aucun contrôle de rôle supplémentaire à écrire. |
| Actions | **Télécharger le manifeste** et **ouvrir l'aperçu en plein écran** | Arbitrage du 2026-08-11. Le téléchargement est le chemin pour dériver un modèle : télécharger, modifier, réinstaller en nouvelle version. |
| Archivage | **Reste sur la liste**, absent du détail | Arbitrage du 2026-08-11. Évite deux points d'entrée pour la même action. |
| Section « Utilisé par » | Comptage **et** liste des événements et organisations | C'est l'information qu'on ne peut obtenir nulle part ailleurs, et celle qui manque au moment d'archiver. Zéro utilisation est en soi une information. |
| Ressources embarquées | Listées **depuis le stockage**, avec leur poids | Le manifeste dit ce qui est référencé ; le stockage dit ce qui est réellement présent. C'est cette seconde information qui permet de vérifier une installation. |
| Composant d'aperçu | **Extrait** de `BadgeTemplatePicker` vers `src/components/ui/` | Il servira à trois endroits — sélecteur, liste, détail. En écrire une troisième variante serait une duplication. |

### Alternatives écartées

| Alternative | Statut | Raison |
|---|---|---|
| Archiver depuis le détail | Non retenue | Écartée le 2026-08-11 : dupliquerait une action déjà présente sur la liste. |
| Lister les ressources depuis le manifeste plutôt que le stockage | Non retenue | Ne dirait que ce qui est *déclaré*, pas ce qui est *présent* — donc incapable de révéler une installation incomplète. |
| Aperçu rendu à la volée côté client | Non retenue | Le PDF d'épreuve existe déjà et reflète le vrai rendu ; le recalculer serait à la fois plus lourd et moins fidèle. |

## Architecture cible

### Écran

`src/app/platform/badge-templates/[id]/page.tsx` — Server Component, six sections :

1. **En-tête** : libellé, `famille · vN`, état, dimensions, nombre de pages, date
   d'installation.
2. **Aperçu** : le PDF d'épreuve, plus large que dans le sélecteur, avec un lien
   « Ouvrir en plein écran » vers `/api/files/<previewPath>`.
3. **Utilisé par** : comptages sur `Event`, `Organization` et `PlatformSettings`, avec la
   liste des événements et organisations concernés et un lien vers leurs écrans.
4. **Versions de la famille** : toutes les lignes partageant le `family`, avec version,
   date, état et lien ; la version courante est marquée.
5. **Ressources embarquées** : fichiers sous `assetPrefix` avec leur poids. **Section
   masquée** si le paquet n'en a aucune — le cas des deux modèles livrés.
6. **Manifeste** : le JSON formaté dans un bloc défilant, avec le bouton de
   téléchargement.

### Stockage

`src/lib/storage.ts` gagne une fonction, calquée sur `deletePrefix` qui utilise déjà
`ListObjectsV2Command` :

```ts
export async function listPrefix(prefix: string): Promise<Array<{ key: string; size: number }>>;
```

### Téléchargement du manifeste

Client Component déclenchant un téléchargement depuis le JSON déjà rendu par le serveur,
nommé `<famille>-v<N>.json`. **Aucune route API** : le layout est déjà dans la page, une
route n'ajouterait qu'une frontière à garder.

### Composant d'aperçu partagé

`TemplatePreview` quitte `BadgeTemplatePicker` pour `src/components/ui/TemplatePreview.tsx`,
inchangé dans son comportement : image pour un aperçu bitmap, `<object>` pour un PDF,
vignette neutre en l'absence d'aperçu. Il est ensuite consommé par le sélecteur, la liste
du catalogue et la page de détail.

## Correctif au passage

La page liste affiche désormais une vignette d'aperçu par ligne, et chaque ligne devient un
lien vers son détail.

## Tests

- `listPrefix` en unitaire : préfixe vide, préfixe peuplé, poids remontés.
- E2E : un staff ouvre le détail depuis la liste, voit l'aperçu, le nombre d'utilisations,
  les versions de la famille et le manifeste ; il télécharge le manifeste. Un template
  utilisé par un événement affiche bien cet événement.
- Les composants React ne sont pas couverts par l'unitaire (politique de tests, section 1) :
  l'écran est validé par l'E2E.

## Documentation impactée

`docs/v4/features/templates-badges.md` — la section « Aperçu » mentionne le nouvel écran et
ce qu'on y trouve.
