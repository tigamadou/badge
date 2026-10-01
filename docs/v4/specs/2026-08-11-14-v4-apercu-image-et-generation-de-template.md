# Spec v4 — Aperçu en image et génération d'un squelette de template

> **Statut** : conception validée — 2026-08-11 — **à implémenter**
> **Type** : évolution du format de paquet + outillage de développement
> **Périmètre** : v4
> **Dépend de** : specs 10 à 13
> **Révise** : la décision « aperçu généré, jamais fourni » de [`2026-08-11-11`](2026-08-11-11-v4-catalogue-et-installation-de-templates.md)

## Contexte et objectifs

Deux frictions apparues à l'usage.

**L'aperçu est un PDF.** Le catalogue et la page de détail l'affichent dans un `<object>`,
donc à travers le lecteur PDF du navigateur — qui superpose sa propre barre d'outils
(menu, pagination, zoom, impression) à la vignette. Le résultat est illisible en petit et
inélégant en grand. Une image ordinaire n'a aucun de ces défauts.

**Créer un template part de rien.** Aucun outil ne produit un squelette de paquet : il
faut écrire le manifeste à la main, en connaissant le format, puis fabriquer l'archive.
Le format est documenté, mais rien ne l'amorce.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| Source de l'aperçu | Une **image fournie dans le paquet**, déclarée par un champ `preview` du manifeste | Une image s'affiche sans lecteur intercalé. Arbitrage du 2026-08-11, qui révise la décision de la spec 11. |
| Emplacement | Un fichier de `assets/`, référencé par le manifeste | Cohérent avec les autres ressources : mêmes contrôles de format et de présence, aucun emplacement nouveau à autoriser. |
| Obligation | **Optionnel** | Les deux paquets livrés n'ont pas d'image ; les forcer à en avoir imposerait d'en produire deux avant tout. |
| Absence d'image | **Placeholder** | Arbitrage du 2026-08-11. `TemplatePreview` le rend déjà : aucun code à écrire. |
| Rendu d'épreuve | **Conservé** comme validation d'installation | C'est lui qui garantit qu'un template accepté au catalogue s'imprime. Le retirer déplacerait la découverte du problème au jour de l'impression. |
| PDF d'épreuve | **Conservé et téléchargeable** depuis la page de détail | Arbitrage du 2026-08-11. Il reste le seul moyen de vérifier le rendu aux dimensions réelles, mais il cesse d'être la vignette. |
| Outillage | **Deux commandes** : générer un squelette, puis l'empaqueter | Arbitrage du 2026-08-11 : éditer et empaqueter sont deux moments distincts du travail. Une commande unique produisant un ZIP obligerait à le déballer pour l'éditer. |

### Alternatives écartées

| Alternative | Statut | Raison |
|---|---|---|
| Convertir le PDF en image à l'installation | Non retenue | Imposerait une bibliothèque de rendu PDF, lourde et sensible à l'environnement Docker, pour un résultat que l'auteur du paquet peut fournir lui-même. |
| Image obligatoire à la racine sous un nom fixe | Non retenue | Écartée le 2026-08-11 au profit d'une déclaration dans le manifeste, plus homogène avec les autres ressources. |
| Supprimer le rendu d'épreuve | Non retenue | Ferait perdre la garantie qu'un paquet installé est imprimable. |
| Une seule commande produisant directement le ZIP | Non retenue | Le gain de frappe est annulé par la nécessité de déballer pour éditer. |

## Architecture cible

### Manifeste

```json
{
  "formatVersion": 1,
  "family": "salon-2027",
  "label": "Badge Salon 2027",
  "preview": "assets/apercu.png",
  "page": { "widthMm": 85.6, "heightMm": 54, "count": 1 },
  "blocks": [ … ]
}
```

`preview` est optionnel. S'il est présent, le fichier doit exister dans l'archive et
franchir les contrôles de format déjà appliqués aux images (JPEG ou PNG, vérifiés sur les
octets d'en-tête, 5 Mo maximum).

### Modèle

`InstalledBadgeTemplate` distingue les deux fichiers :

```prisma
previewPath   String?   // image d'apercu, issue du manifeste
proofPath     String?   // PDF d'epreuve, produit a l'installation
```

`previewPath` change de nature — il désignait le PDF, il désigne désormais l'image — et
`proofPath` recueille le PDF. Aucune migration de données : l'application n'est pas en
production, `make db-push` suivi de `make db-seed` suffit.

### Installation

`installTemplate` conserve exactement sa séquence, à une nuance près :

1. rendu d'épreuve — **inchangé**, un paquet qui ne s'imprime pas est refusé et ses
   ressources nettoyées ;
2. écriture des ressources du paquet ;
3. écriture du PDF sous `${assetPrefix}proof.pdf` → `proofPath` ;
4. `previewPath` reçoit `${assetPrefix}<preview declare>` si le manifeste en déclare un,
   sinon `null`.

### Affichage

Le catalogue et la page de détail passent `previewUrl(previewPath)` à `TemplatePreview`,
qui rend l'image ou, à défaut, le placeholder. La page de détail gagne un bouton
**Télécharger le PDF d'épreuve**, à côté du téléchargement du manifeste, affiché seulement
si `proofPath` existe.

`TemplatePreview` **conserve sa branche PDF** : les lignes installées avant ce changement
pointent encore vers un `preview.pdf` et doivent continuer de s'afficher.

### Outillage

```bash
make new-badge-template NAME=salon-2027
make pack-badge-template NAME=salon-2027
```

Le squelette naît dans `badge-templates/<nom>/`, à la racine du dépôt, dans un dossier
**gitignoré** : c'est un atelier de travail, pas une source versionnée. Il ne doit pas être
confondu avec `prisma/badge-templates/`, qui contient les paquets de référence installés
par le seed.

```
badge-templates/salon-2027/
├── manifest.json     minimal mais valide : titre, identite, QR, bande categorie
├── README.md         format, sources disponibles, marche a suivre
└── assets/           vide ; y deposer l'image d'apercu
```

Le `README.md` compense une limite du format : JSON n'accepte pas de commentaires. C'est
donc là que vivent la liste des sources, les types de blocs et les règles de validation.

`pack-badge-template` produit `badge-templates/<nom>.zip` avec `jszip`, déjà dépendance du
projet. Il **valide le manifeste avant d'empaqueter** et refuse de produire une archive
invalide : mieux vaut échouer à l'empaquetage, où le message est immédiat, qu'au
téléversement.

## Tests

- Schéma : `preview` déclaré et présent, déclaré mais absent de l'archive, format refusé,
  champ absent.
- Installation : l'image devient `previewPath`, le PDF devient `proofPath`, un paquet sans
  `preview` laisse `previewPath` à `null` tout en produisant un `proofPath`.
- Empaquetage : une archive produite depuis un squelette généré s'installe sans erreur ;
  un manifeste invalide fait échouer l'empaquetage.
- E2E : la page de détail affiche le placeholder pour un template sans image, l'image pour
  un template qui en déclare une, et propose le téléchargement du PDF d'épreuve.

## Documentation impactée

- `docs/v4/features/templates-badges.md` — le champ `preview`, la distinction entre image
  d'aperçu et PDF d'épreuve, et les deux commandes.
- `docs/v4/installation.md` — les deux nouvelles cibles `make`.
