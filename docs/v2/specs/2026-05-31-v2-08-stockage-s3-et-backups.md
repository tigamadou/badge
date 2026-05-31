# Spec v2-08 — Stockage S3 (MinIO) et backups hebdomadaires

> **Statut** : conception validée — 2026-05-31
> **Type** : nouvelle infrastructure (stockage + sauvegarde)
> **Périmètre** : v2 uniquement
> **Spec maîtresse** : [`docs/v2/specs/2026-05-28-v2-master-design.md`](2026-05-28-v2-master-design.md)
> **Specs liées (futures)** : v2-09 (observabilité/logs centralisés), v2-10 (queue jobs asynchrones)

## Contexte et objectifs

La v1 stocke les fichiers utilisateurs (logos d'événement, photos de profil, justificatifs PDF, badges générés) en local sur le disque du conteneur, sous `uploads/`. Cette approche ne tient plus en v2 :

- **Multi-tenant** : les fichiers doivent être scopés par organisation et par événement, avec une structure de clés exploitable par le code et par les opérations d'archivage.
- **Reproductibilité** : un volume Docker `uploads/` couplé au conteneur applicatif rend les sauvegardes fragiles et les restaurations incomplètes.
- **Sécurité des sauvegardes** : la v1 a `make backup-prod` qui produit un `mysqldump` + un `uploads.tar.gz` non chiffrés, conservés sur le même serveur que la production. Une panne disque, un `rm -rf` malheureux ou une compromission du serveur entraîne la perte simultanée de la production **et** de ses backups.

Cette spec définit :

1. Le passage d'un stockage local à un stockage S3-compatible (MinIO self-hosted dans Docker) avec une organisation de bucket multi-tenant.
2. Un pipeline de sauvegarde hebdomadaire complet (BDD + bucket + config), chiffré bout-en-bout, poussé vers une cible distante hors-serveur (Hetzner Storage Box).
3. Une procédure de restauration interactive avec garde-fous (confirmation, snapshot de précaution, audit).

## Décisions tranchées (synthèse ADR)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Provider stockage | MinIO self-hosted dans Docker | Pas de dépendance cloud externe, S3-compatible donc code agnostique, sur le même serveur que MySQL et l'app pour la simplicité opérationnelle. |
| Organisation des objets | 1 bucket `badge-prod` avec préfixes `orgs/{orgId}/events/{eventId}/...` | Pattern S3 standard pour SaaS multi-tenant. Évite l'explosion du nombre de buckets (MinIO préfère des préfixes profonds). IAM scoping simple. Archivage d'org = `mc rm --recursive` sur un préfixe. |
| SDK applicatif | `@aws-sdk/client-s3` v3 | SDK universel. Si on migre MinIO → AWS S3 / Scaleway / R2 plus tard, seul l'endpoint change. Tree-shakable. |
| Outil de backup | Script shell maison (`mysqldump` + `mc` + `rclone` + `age`) | Cohérent avec le style du projet (Makefile + scripts). Pas de dépendance binaire exotique. Contrôle total sur le pipeline. La rétention/dedup sont assumés à la main. |
| Cibles backup | Locale (hors dossier projet) **et** Hetzner Storage Box BX11 (SFTP via rclone) | Stratégie 3-2-1 simplifiée. Locale = restore rapide. Distante = disaster recovery. MinIO étant sur le même serveur que la BDD, ne PAS sortir les backups est inacceptable. |
| Périmètre snapshot | BDD + bucket MinIO + `.env.production` + `Caddyfile` | Snapshot autoporteur : un seul fichier reconstitue intégralement le service. Les secrets sont protégés par le chiffrement `age`. |
| Rétention | 4 hebdo + 6 mensuels (GFS léger) | ~10 snapshots actifs, couvre 6 mois en arrière. Standard pour un SaaS, bon compromis volume/profondeur. |
| Chiffrement | `age` (clé publique sur serveur, clé privée hors serveur) | Asymétrique : le serveur peut chiffrer, jamais déchiffrer. Une compromission du serveur n'expose ni les backups passés ni les futurs. Outil moderne, binaire unique. |
| Trigger | Cron de l'hôte → `make backup-prod` (dimanche 03h00) | Simple, lisible, inspectable via `crontab -l`. Pas de conteneur cron dédié à maintenir en plus de MinIO. |
| Monitoring | Email SMTP synchrone + log JSON local rotatif | Email systématique (succès comme échec) → l'absence d'email est elle-même une alerte. Log JSON = format directement consommable par v2-09 (Loki/Graylog) plus tard. |
| Restore | `make restore-from-backup` interactif + doc `docs/v2/operations/restore.md` | Double confirmation, snapshot de précaution automatique avant écrasement, audit dans `ActivityLog`. |
| Hors-scope | Logs centralisés (v2-09), queue jobs asynchrones (v2-10) | Décomposition explicite pour éviter une mega-spec. Chacun a ses propres arbitrages. |

## Architecture de stockage

### Service MinIO dans Docker

Ajout d'un service `minio` dans `docker-compose.dev.yml` et `docker-compose.yml`, à côté de `app`, `mysql`, `mailpit` :

```yaml
minio:
  image: minio/minio:latest
  restart: unless-stopped
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
  volumes:
    - minio-data:/data
  networks:
    - badge
volumes:
  minio-data:
```

- En **dev** : ports `9000` (data) et `9001` (console) exposés sur l'hôte pour introspection.
- En **prod** : aucun port exposé sur Internet. MinIO est joignable uniquement via le réseau Docker interne (depuis `app`). La console (`9001`) est accessible via un tunnel SSH temporaire (`ssh -L 9001:minio:9001`) ou un futur sous-domaine Caddy IP-restreint (hors-scope).

### Organisation des clés (multi-tenant)

Un **seul bucket** : `badge-dev` en dev, `badge-prod` en prod. Structure des clés :

```
orgs/{orgId}/
  logo.{ext}
  events/{eventId}/
    settings/
      logo.{ext}
      header.{ext}
    registrations/{regId}/
      passport.pdf
      photo.{ext}
    badges/
      {regId}.pdf       (badges générés, cache)
```

**Conséquences pratiques :**

- Toute lecture/écriture passe par un préfixe contenant `orgId` → défense en profondeur si `storage.ts` vérifie le préfixe avant l'opération.
- Archivage d'une organisation = `DeleteObjects` paginé sur le préfixe `orgs/{orgId}/`.
- Le miroir backup est trivial : `mc mirror minio-local/badge-prod /staging/minio/`.
- Aucun migration depuis la v1 (la v2 part d'une base vide).

### Adaptation de `src/lib/storage.ts`

L'API publique passe de :

```typescript
uploadFile(key, body, contentType) → string
getFile(key) → { body, contentType }
```

à :

```typescript
uploadFile(key, body, contentType) → string         // inchangé côté signature
getFile(key) → { body, contentType }                 // inchangé côté signature
deleteFile(key) → void                               // NOUVEAU
deletePrefix(prefix) → number                        // NOUVEAU, retourne le nombre d'objets supprimés
```

L'implémentation bascule de `fs/promises` vers `@aws-sdk/client-s3` :

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand,
         DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,             // http://minio:9000 en interne
  region: process.env.S3_REGION ?? "us-east-1",  // MinIO ignore mais le SDK exige
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,                           // requis pour MinIO
});
```

### Variables d'environnement ajoutées

```
# MinIO
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=<clé applicative, distincte du root>
S3_SECRET_KEY=<secret>
S3_BUCKET=badge-prod
MINIO_ROOT_USER=<admin>
MINIO_ROOT_PASSWORD=<long random>
```

### Bootstrap du bucket

Ajout d'une cible `make minio-init` (script `scripts/minio-init.sh`) qui :

1. Attend que MinIO réponde.
2. Crée le bucket s'il n'existe pas (`mc mb`).
3. Crée une clé d'accès **applicative** (`S3_ACCESS_KEY` / `S3_SECRET_KEY`) si elle n'existe pas.
4. Attache une policy scopée sur ce bucket uniquement (`s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`), sans droit de créer/supprimer le bucket lui-même ni d'accéder à d'autres buckets.

Idempotent. Exécuté une fois au déploiement initial (à intégrer à la spec v2-07 `deploiement-initial.md`).

## Pipeline de backup

### Script `scripts/backup-prod.sh`

Étapes en séquence (`set -euo pipefail`) :

```
1. Préparation
   - Vérifier dépendances : mysqldump, mc, rclone, age, tar, zstd, jq, msmtp
   - Créer répertoire staging horodaté
     /var/backups/badge/staging/snapshot-YYYY-MM-DD-HHMMSS/

2. Capture BDD
   - docker compose -f docker-compose.yml exec -T mysql \
       mysqldump --single-transaction --routines --triggers --events \
                 -u root -p"$MYSQL_ROOT_PASSWORD" badge \
       | gzip > staging/.../db.sql.gz
   - Vérifier exit code ET taille > 0

3. Miroir MinIO
   - mc mirror --quiet --overwrite minio-local/badge-prod staging/.../minio/
   - Vérifier : nombre d'objets miroir = nombre d'objets bucket

4. Capture config
   - cp /opt/badge/.env.production staging/.../env.production
   - cp /opt/badge/Caddyfile        staging/.../Caddyfile

5. Métadonnées
   - staging/.../metadata.json :
     { createdAt, gitSha, appVersion, dbSizeBytes,
       bucketObjectCount, bucketSizeBytes, hostname }

6. Empaquetage + chiffrement (streaming, pas d'intermédiaire en clair)
   - tar -cf - -C staging snapshot-YYYY-MM-DD-HHMMSS \
     | zstd -T0 -19 \
     | age --recipients-file /etc/badge/age-recipients.txt \
     > /var/backups/badge/snapshots/snapshot-YYYY-MM-DD-HHMMSS.tar.zst.age

7. Cleanup staging
   - rm -rf staging/snapshot-YYYY-MM-DD-HHMMSS

8. Push vers Hetzner
   - rclone copy /var/backups/badge/snapshots/snapshot-YYYY-MM-DD-HHMMSS.tar.zst.age \
                 hetzner:badge-backups/

9. Rotation GFS (locale ET distante)
   - scripts/rotate-snapshots.sh --target local
   - scripts/rotate-snapshots.sh --target hetzner

10. État final
    - Écrire /var/backups/badge/last-status.json
    - Ajouter ligne JSON à /var/log/badge/backup.log
    - Envoyer email récap (succès ou échec) via msmtp
```

### Choix techniques

- **`zstd -19`** au lieu de `gzip` : ~30 % de gain de compression sur du SQL et des PDF mal compressibles. Coût CPU acceptable une fois par semaine.
- **Streaming `tar | zstd | age`** : aucune écriture intermédiaire en clair sur le disque. Le seul artefact qui touche le disque est déjà chiffré.
- **Plusieurs destinataires `age`** (`--recipients-file`) : minimum 2. Si on perd la clé privée principale, la backup reste déchiffrable avec la secours.
- **`mc mirror`** plutôt que `mc cp --recursive` : idempotent, gère les grands buckets, copie en parallèle.
- **Pas de déduplication** : assumé. Compensé par (a) la compression zstd, (b) la rétention GFS courte (10 snapshots actifs), (c) le prix fixe de Hetzner Storage Box (3,20 €/mois pour 1 To).

### Format d'un snapshot après empaquetage

Un seul fichier autonome `snapshot-2026-05-31-030012.tar.zst.age`, qu'on peut déplacer, transférer, archiver. Après `age -d | unzstd | tar -x` :

```
snapshot-2026-05-31-030012/
├── db.sql.gz
├── minio/
│   └── orgs/{orgId}/...
├── env.production
├── Caddyfile
└── metadata.json
```

### Politique de rétention GFS (`scripts/rotate-snapshots.sh`)

Algorithme :

```
Input : liste de snapshots (locaux ou distants) horodatés.
Garde :
  - Les 4 snapshots les plus récents (hebdo glissant).
  - Pour chacun des 6 derniers mois calendaires (hors mois courant) :
      le 1er snapshot pris ce mois-là (mensuel).
Supprime tous les autres.
```

À l'état stable : ~10 snapshots actifs. Volume distant ≈ 10 × taille d'un snapshot.

Le script est invoqué deux fois : `--target local` (liste `/var/backups/badge/snapshots/`) et `--target hetzner` (`rclone lsjson hetzner:badge-backups/`). Même logique, source listée différemment.

### Dépendances binaires côté hôte

- `docker` / `docker compose` (déjà présent)
- `mc` (MinIO Client), `rclone`, `age`, `zstd`, `jq`, `msmtp` (logrotate déjà présent)

Tous installables via apt ou binaires statiques. Cible `make install-backup-deps` (script `scripts/install-backup-deps.sh`) qui installe l'ensemble (idempotent).

## Orchestration : Makefile, cron, monitoring

### Cibles `Makefile` ajoutées

```
backup-prod              Lance un backup complet (BDD + bucket + config)
backup-prod-dry-run      Simule un backup sans écrire ni pousser
backup-list              Liste les snapshots locaux et distants (fusion)
backup-list-local        Liste uniquement les snapshots locaux
backup-list-remote       Liste uniquement les snapshots distants
restore-from-backup      Restaure interactivement depuis un snapshot
install-backup-deps      Installe mc, rclone, age, zstd, jq, msmtp (root)
minio-init               Crée le bucket + clé applicative scopée (idempotent)
```

Les paramètres sensibles (chemins backups, credentials Hetzner, recipients age, SMTP) viennent de `.env.production`, chargé par le Makefile via `include` et `export`.

### Cron de l'hôte (`/etc/cron.d/badge-backup`)

```
PATH=/usr/local/bin:/usr/bin:/bin

# Backup hebdomadaire, dimanche 03h00
0 3 * * 0 root cd /opt/badge && /usr/bin/make backup-prod >> /var/log/badge/backup-cron.log 2>&1
```

- **Dimanche 03h** : faible activité utilisateur, loin de toute fenêtre de déploiement matinale.
- **Tourne en root** : nécessaire pour lire `.env.production` (mode 600) et écrire dans `/var/backups/`.

### Logs

**`/var/log/badge/backup.log`** (JSON Lines structuré, écrit par le script) :

```jsonl
{"ts":"2026-05-31T03:00:12Z","level":"info","event":"backup.start","snapshot":"snapshot-2026-05-31-030012"}
{"ts":"2026-05-31T03:00:15Z","level":"info","event":"backup.db.dumped","sizeBytes":204812345,"durationMs":3142}
{"ts":"2026-05-31T03:01:47Z","level":"info","event":"backup.minio.mirrored","objectCount":1284,"sizeBytes":18234567890,"durationMs":92103}
{"ts":"2026-05-31T03:03:21Z","level":"info","event":"backup.packed","archiveSizeBytes":15678912345,"durationMs":94002}
{"ts":"2026-05-31T03:08:11Z","level":"info","event":"backup.pushed","target":"hetzner","durationMs":289834}
{"ts":"2026-05-31T03:08:14Z","level":"info","event":"backup.rotated","target":"local","keptCount":10,"removedCount":1}
{"ts":"2026-05-31T03:08:18Z","level":"info","event":"backup.rotated","target":"hetzner","keptCount":10,"removedCount":1}
{"ts":"2026-05-31T03:08:19Z","level":"info","event":"backup.complete","totalDurationMs":487123,"exitCode":0}
```

Format directement consommable par Loki/Graylog/Vector (spec v2-09).

**`/var/log/badge/backup-cron.log`** : stdout/stderr brut du `make backup-prod`, utile pour debug si le script crash avant d'écrire son propre log.

### Rotation des logs (`/etc/logrotate.d/badge-backup`)

```
/var/log/badge/*.log {
    weekly
    rotate 12
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
}
```

12 semaines de logs conservés.

### Fichier d'état (`/var/backups/badge/last-status.json`)

Écrit en dernier par le script :

```json
{
  "lastRunAt": "2026-05-31T03:00:12Z",
  "lastRunDurationMs": 487123,
  "lastRunSuccess": true,
  "lastSuccessAt": "2026-05-31T03:00:12Z",
  "lastFailureAt": "2026-05-24T03:02:17Z",
  "lastFailureReason": null,
  "lastSnapshotName": "snapshot-2026-05-31-030012.tar.zst.age",
  "lastSnapshotSizeBytes": 15678912345,
  "localSnapshotCount": 10,
  "remoteSnapshotCount": 10
}
```

Permet à un futur dashboard (v2-09) ou à un healthcheck CLI de lire l'état actuel sans parser les logs.

### Monitoring par email

Email envoyé **à chaque exécution** (succès comme échec) à `BACKUP_NOTIFY_EMAIL`, via `msmtp` configuré sur les variables `PLATFORM_SMTP_*`. Raisonnement : un cron qui ne tourne plus = aucun email = alerte humaine évidente ("ça fait 10 jours que je n'ai pas reçu d'email backup").

Templates de sujet :

- Succès : `[Badge prod] Backup OK — 2026-05-31 (15.6 Go)`
- Échec : `[Badge prod] Backup ECHEC — 2026-05-31`

Le corps d'échec contient l'étape qui a échoué, le dernier `stderr`, le snapshot précédent OK, et le chemin du log complet.

## Restore

### Modes d'invocation

```
make restore-from-backup                                # interactif complet
make restore-from-backup SNAPSHOT=2026-05-24-030012     # cible un snapshot précis
make restore-from-backup SNAPSHOT=X CONFIRM=I-UNDERSTAND-THIS-IS-DESTRUCTIVE
                                                        # skip confirmation interactive (runbook)
make restore-from-backup DRY_RUN=1 SNAPSHOT=X           # déchiffre, valide, n'écrit rien
```

### Flot interactif

1. **Lister** les snapshots disponibles (local + distant fusionnés, triés par date décroissante, avec tag `[LOCAL]`, `[HETZNER]`, `[LOCAL+HETZNER]`).
2. **Sélection** : `Quel snapshot restaurer ? [1-10, q pour quitter]`.
3. Si snapshot distant uniquement : **téléchargement** vers `/var/backups/badge/restore-staging/`.
4. **Déchiffrement** + extraction (l'identité `age` privée DOIT être présente sur le serveur, sinon abandon).
5. **Validation intégrité** : présence des 5 entrées (`db.sql.gz`, `minio/`, `env.production`, `Caddyfile`, `metadata.json`), `gunzip -t db.sql.gz`, comparaison `objectCount` ↔ `metadata.bucketObjectCount`.
6. **Confirmation niveau 1** : résumé + `Tapez 'RESTORE-PROD-CONFIRM' pour continuer`.
7. **Snapshot de précaution automatique** : `scripts/backup-prod.sh` est invoqué avec un tag spécial `pre-restore-YYYY-MM-DD-HHMMSS.tar.zst.age`. Ce snapshot n'est PAS soumis à la rotation GFS (préfixe `pre-restore-` exclu de l'algorithme). Sa suppression est **exclusivement manuelle** : l'opérateur le supprime à la main (`rm` côté local + `rclone delete` côté distant) après avoir validé que le restore est définitivement stable. Recommandation : conserver au moins 30 jours.
8. **Confirmation niveau 2** : `Snapshot de précaution créé. Tapez 'GO' pour lancer le restore irréversible`.
9. **Restore en séquence** :
   - BDD : `DROP DATABASE; CREATE DATABASE;` puis `mysql < db.sql.gz`.
   - Bucket MinIO : `mc rm --recursive --force` puis `mc mirror --overwrite`.
   - Config : `.env.production` et `Caddyfile` **ne sont PAS écrasés automatiquement**. Le script pose des fichiers `.restored` à côté et affiche un diff. L'opérateur décide à la main.
10. **Cleanup** staging.
11. **Smoke tests post-restore** : `make smoke-tests`. Si KO : alerte avec instructions de rollback via le snapshot de précaution.
12. **Email final** : `[Badge prod] Restore EFFECTUE` ou `[Badge prod] Restore ECHEC à l'étape X`.

### Choix techniques

- **Snapshot de précaution automatique** : ~8 minutes de plus par restore, négligeable face au coût d'un restore raté. Indispensable même quand on est certain du snapshot source.
- **`DROP/CREATE DATABASE`** : seul moyen propre de garantir qu'une table/colonne présente en prod mais absente du snapshot disparaisse. Plus simple à raisonner qu'un `mysql --replace` ou un `TRUNCATE TABLE`.
- **`mc rm --recursive` puis `mc mirror`** (pas `mc mirror --remove`) : garantit que le bucket post-restore = exactement le contenu du snapshot, byte pour byte. Symétrique avec le restore BDD.
- **Config non-écrasée automatiquement** : un `.env.production` ancien peut casser instantanément la prod (credentials SMTP/MinIO/Hetzner qui ont peut-être tourné depuis). Pour 99 % des restores (corruption BDD, perte d'un fichier), la config courante reste valide.

### Doc opérationnelle : `docs/v2/operations/restore.md`

Document vivant (runbook), pas une spec. Contient :

1. Quand restaurer (cas d'usage : corruption BDD, suppression accidentelle, retour arrière post-incident, audit RGPD).
2. Pré-requis (identité `age` privée disponible, accès root, `BACKUP_NOTIFY_EMAIL` configuré).
3. Procédure standard (la liste interactive ci-dessus).
4. Procédure d'urgence (serveur prod perdu : reprovisionner, copier les credentials Hetzner depuis le coffre, `make restore-from-backup`).
5. Rollback d'un restore (utiliser le snapshot `pre-restore-*`).
6. Comment tester un restore en safe mode (`docker-compose.restore-test.yml` isolé sur ports différents).
7. Que faire si la clé `age` privée est perdue (réponse : rien, les backups sont irrécupérables — d'où l'insistance sur les 2 recipients minimum).

### Test de restore manuel trimestriel : `scripts/test-restore.sh`

Pour mitiger le risque "backup pourri silencieusement" sans introduire un test automatisé mensuel :

- Démarre un `docker-compose.restore-test.yml` (mysql-test + minio-test sur ports différents).
- Restaure le dernier snapshot dedans.
- Lance `make smoke-tests` contre cet env isolé.
- Émet un rapport.
- Détruit l'env.

Déclenchement manuel une fois par trimestre par l'opérateur. Pas de cron.

## Sécurité

### Gestion des clés `age`

**Génération initiale** (une fois, sur le poste d'admin, JAMAIS sur le serveur) :

```bash
age-keygen -o admin-identity.txt        # clé PRIVÉE → coffre 1
age-keygen -o backup-identity.txt       # clé PRIVÉE de secours → coffre 2
```

**Sur le serveur** (`/etc/badge/age-recipients.txt`, root:root 644) :

```
# Clés publiques autorisées à déchiffrer les backups Badge.
age1abc...xyz  # Admin principal (coffre 1Password personnel)
age1def...uvw  # Admin secours (coffre Bitwarden équipe)
```

**Règle dure** : les fichiers `*-identity.txt` ne touchent **jamais** le serveur de production en conditions stables. Le serveur n'a que les clés **publiques** : il peut chiffrer, jamais déchiffrer. Même un attaquant qui obtient root sur le serveur ne peut pas lire les backups passés ni futurs.

**Pour restaurer** : l'opérateur déploie temporairement son identité privée (`scp identity.txt root@serveur:/root/.config/age/`), exécute le restore, **supprime** l'identité (`shred -u`). Alternative : déchiffrer localement, puis push le snapshot déchiffré.

**Rotation des clés** : annuelle. Procédure :

1. Génération d'une nouvelle paire admin.
2. Ajout de la nouvelle clé publique à `age-recipients.txt`.
3. Après 1 mois (cycle GFS complet), retrait de l'ancienne clé publique du fichier `recipients`. L'ancienne clé privée reste conservée au coffre pour audit (déchiffrement des snapshots historiques).

Doc dédiée : `docs/v2/operations/age-keys.md`.

### Secrets et leur localisation

| Secret | Où vit-il | Forme |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | `.env.production` (root:root 600) | Plain |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `.env.production` | Plain |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `.env.production` | Plain |
| `NEXTAUTH_SECRET` | `.env.production` | Plain |
| `PLATFORM_SMTP_*` | `.env.production` | Plain |
| Credentials Hetzner SFTP | `/etc/badge/rclone.conf` (root:root 600) | Plain (format rclone) |
| Clés publiques `age` | `/etc/badge/age-recipients.txt` (root:root 644) | Plain (publiques) |
| Clés privées `age` | **JAMAIS sur le serveur** — coffre externe | — |

Tout `.env.production` et `/etc/badge/*` est inclus dans le snapshot (cf section Pipeline). Tout est chiffré par `age` avant de quitter le disque ou de partir vers Hetzner. Les snapshots sont **autoporteurs et sûrs**.

### Permissions filesystem

```
/opt/badge/                              root:root  755
/opt/badge/.env.production               root:root  600
/opt/badge/Caddyfile                     root:root  644
/etc/badge/                              root:root  755
/etc/badge/age-recipients.txt            root:root  644
/etc/badge/rclone.conf                   root:root  600
/var/backups/badge/                      root:root  700
/var/backups/badge/snapshots/            root:root  700
/var/backups/badge/staging/              root:root  700
/var/log/badge/                          root:adm   750
/var/log/badge/backup.log                root:adm   640
~root/.config/age/identity.txt           root:root  600   # éphémère pendant restore seulement
```

Seul `root` lit/écrit dans ces emplacements. Le conteneur `app` ne touche ni à `/var/backups/` ni à `/etc/badge/`.

### IAM MinIO : séparation root/applicatif

- **`MINIO_ROOT_USER`** : utilisé uniquement par les scripts d'admin (`minio-init`, console web) et par `mc` côté hôte pour le `mc mirror` du backup. Tout-puissant.
- **`S3_ACCESS_KEY` (applicatif)** : créé par `minio-init`, scopé sur le bucket `badge-prod`, droits `s3:GetObject|PutObject|DeleteObject|ListBucket`. **Pas** de droit de créer/supprimer le bucket, pas d'accès à d'autres buckets.

Policy attachée à la clé applicative :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::badge-prod/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::badge-prod"
    }
  ]
}
```

Une compromission du conteneur `app` n'expose **que** le bucket `badge-prod`, et l'attaquant ne peut pas drop le bucket ni accéder à d'autres ressources MinIO.

### Exposition réseau

- **MinIO** (`9000` data, `9001` console) : non exposé sur Internet en prod. Joignable uniquement via le réseau Docker interne. Console accessible par tunnel SSH (`ssh -L 9001:minio:9001`) ou par sous-domaine Caddy IP-restreint (hors-scope de cette spec).
- **MySQL** (`3306`) : non exposé (existant).
- **Hetzner SFTP** : sortant uniquement. Le serveur initie la connexion vers `<account>.your-storagebox.de:23`.

### Audit dans `ActivityLog`

Ajout d'une valeur `ActivityType.BACKUP_RESTORE` au schéma Prisma. À chaque restore réussi, le script écrit un `ActivityLog` dans la BDD nouvellement restaurée, contenant :

- Quel snapshot a été restauré
- Qui a lancé le restore (utilisateur SSH, via `$SUDO_USER` ou prompt interactif)
- Quand
- Quel snapshot de précaution est disponible pour rollback

Pourquoi : un restore est un événement aussi sensible qu'une suppression de compte. Trace pérenne obligatoire, qui survit au restore lui-même puisque écrite **après**.

### Risques identifiés

| Risque | Mitigation | Statut |
|---|---|---|
| Clé privée `age` perdue → backups irrécupérables | 2 recipients minimum, conservation en 2 coffres distincts | Accepté |
| Serveur compromis → fuite des secrets `.env.production` actuels | Rotation manuelle des credentials après incident ; snapshots historiques restent chiffrés et illisibles | Accepté |
| Hetzner compromis → fuite des snapshots | Snapshots `age`-chiffrés ; exposition nulle même avec un dump complet | Accepté |
| Backup pourri silencieusement (BDD corrompue depuis plusieurs semaines) | Test de restore manuel trimestriel via `scripts/test-restore.sh` | Mitigé partiellement |
| Cron qui ne tourne plus → plus de backup en silence | Email systématique à chaque exécution ; absence d'email > 8 jours = alerte | Mitigé |
| Disque local serveur plein → backup local échoue | Alerte d'usage disque à intégrer dans v2-09 (observabilité) | À reporter |
| Coût Hetzner Storage Box explose | Plafond fixe 3,20 €/mois jusqu'à 1 To | Accepté |

## Intégration concrète au repo

### Arborescence des fichiers créés/modifiés

```
badge/
├── docker-compose.dev.yml                                   MODIFIÉ  (service minio)
├── docker-compose.yml                                  MODIFIÉ  (service minio, volume minio-data)
├── Makefile                                          MODIFIÉ  (cibles backup-*, restore-*, minio-init, install-backup-deps)
├── package.json                                      MODIFIÉ  (ajout @aws-sdk/client-s3)
├── .env.example                                      MODIFIÉ  (vars S3_*, MINIO_*, BACKUP_*, RCLONE_*, HETZNER_*)
├── .env.production.example                           MODIFIÉ  (mêmes ajouts, sans valeurs)
│
├── prisma/
│   └── schema.prisma                                 MODIFIÉ  (ActivityType.BACKUP_RESTORE)
│
├── src/
│   └── lib/
│       ├── storage.ts                                MODIFIÉ  (fs/promises → @aws-sdk/client-s3)
│       └── __tests__/storage.test.ts                 CRÉÉ    (tests intégration contre MinIO de dev)
│
├── scripts/
│   ├── backup-prod.sh                                CRÉÉ
│   ├── rotate-snapshots.sh                           CRÉÉ
│   ├── restore-from-backup.sh                        CRÉÉ
│   ├── test-restore.sh                               CRÉÉ
│   ├── list-snapshots.sh                             CRÉÉ
│   ├── minio-init.sh                                 CRÉÉ
│   ├── install-backup-deps.sh                        CRÉÉ
│   ├── audit-permissions.sh                          CRÉÉ    (vérifie les permissions filesystem du tableau Sécurité)
│   └── _lib/
│       ├── log.sh                                    CRÉÉ    (helpers log JSON + stdout)
│       ├── email.sh                                  CRÉÉ    (envoi msmtp avec templates)
│       └── env.sh                                    CRÉÉ    (chargement .env.production + validation)
│
├── ops/
│   ├── cron/badge-backup                             CRÉÉ    (déposé dans /etc/cron.d/)
│   ├── logrotate/badge-backup                        CRÉÉ    (déposé dans /etc/logrotate.d/)
│   ├── rclone/rclone.conf.example                    CRÉÉ    (template config Hetzner SFTP)
│   └── age/age-recipients.txt.example                CRÉÉ    (template recipients)
│
├── docker-compose.restore-test.yml                          CRÉÉ    (env isolé pour test-restore)
│
└── docs/
    └── v2/
        ├── specs/
        │   └── 2026-05-31-v2-08-stockage-s3-et-backups.md    CETTE SPEC
        ├── plans/
        │   └── 2026-XX-XX-v2-08-stockage-s3-et-backups.md    CRÉÉ par writing-plans
        ├── features/
        │   ├── stockage-fichiers-s3.md               CRÉÉ    (doc fonctionnelle stockage)
        │   ├── backups-hebdomadaires.md              CRÉÉ    (doc fonctionnelle backups)
        │   └── deploiement-initial.md                MODIFIÉ  (renvoi vers les nouvelles)
        └── operations/                               CRÉÉ    (nouveau dossier runbooks)
            ├── README.md                             CRÉÉ
            ├── restore.md                            CRÉÉ
            └── age-keys.md                           CRÉÉ
```

### Paliers d'implémentation (vue d'oiseau, détaillé par writing-plans)

```
Palier 1 — Infrastructure stockage
  1.1 Service minio dans docker-compose.dev.yml + docker-compose.yml
  1.2 Variables S3_*, MINIO_* dans .env.example + .env.production.example
  1.3 scripts/minio-init.sh + cible make minio-init
  1.4 Test manuel : MinIO démarre, bucket créé, clé applicative créée

Palier 2 — Adaptation code applicatif (dépend du palier 1)
  2.1 yarn add @aws-sdk/client-s3
  2.2 Refonte src/lib/storage.ts (TDD)
  2.3 src/lib/__tests__/storage.test.ts
  2.4 Audit des appelants de uploadFile/getFile : ajustement vers la nouvelle structure orgs/{orgId}/...
  2.5 Lint + typecheck + tests verts

Palier 3 — Pipeline de backup (indépendant des paliers 1-2 côté code)
  3.1 scripts/_lib/{log.sh, email.sh, env.sh}
  3.2 scripts/backup-prod.sh
  3.3 scripts/rotate-snapshots.sh
  3.4 scripts/list-snapshots.sh
  3.5 scripts/install-backup-deps.sh
  3.6 ops/cron/badge-backup, ops/logrotate/badge-backup
  3.7 ops/rclone/rclone.conf.example, ops/age/age-recipients.txt.example
  3.8 Cibles Makefile : backup-prod, backup-list, install-backup-deps
  3.9 Test manuel sur env de dev : backup-prod-dry-run, backup-prod, vérif artefact age, vérif push Hetzner test

Palier 4 — Restore et audit (dépend du palier 3)
  4.1 scripts/restore-from-backup.sh
  4.2 scripts/test-restore.sh
  4.3 scripts/audit-permissions.sh
  4.4 docker-compose.restore-test.yml
  4.5 Cibles Makefile : restore-from-backup
  4.6 Migration Prisma : ActivityType.BACKUP_RESTORE
  4.7 Test manuel : restore depuis le snapshot de dev, vérif intégrité

Palier 5 — Documentation (parallèle des paliers techniques)
  5.1 docs/v2/features/stockage-fichiers-s3.md
  5.2 docs/v2/features/backups-hebdomadaires.md
  5.3 docs/v2/operations/README.md
  5.4 docs/v2/operations/restore.md
  5.5 docs/v2/operations/age-keys.md
  5.6 Mise à jour docs/v2/features/deploiement-initial.md
  5.7 Mise à jour docs/v2/architecture.md (mention MinIO)
  5.8 Mise à jour docs/v2/README.md (entrée v2-08 dans les tableaux)
```

Paliers 1-2 sont bloquants pour la mise en prod. Paliers 3-4 peuvent suivre dans une PR séparée. Palier 5 accompagne chaque palier technique.

## Critères d'acceptation

Critères vérifiables, regroupés par sous-système. Un PR n'est mergeable que si tous les critères `[bloquant]` sont verts.

### Stockage MinIO

1. `[bloquant]` `make dev` démarre le service `minio` en plus de `app`, `mysql`, `mailpit`. Console accessible sur `http://localhost:9001` en dev.
2. `[bloquant]` `make minio-init` est idempotent : exécuté 2 fois de suite, ni erreur ni doublon. Crée le bucket, une clé applicative scopée et une policy `s3:GetObject|PutObject|DeleteObject|ListBucket` limitée au bucket.
3. `[bloquant]` `src/lib/storage.ts` expose `uploadFile`, `getFile`, `deleteFile`, `deletePrefix`. Les 4 fonctions ont un test d'intégration qui passe contre le MinIO de dev (`make test`).
4. `[bloquant]` Aucun appelant de `uploadFile`/`getFile` ne référence plus `process.cwd()/uploads`. Le dossier `uploads/` du repo n'est plus écrit en runtime.
5. `[bloquant]` La structure des clés respecte `orgs/{orgId}/events/{eventId}/...` partout (vérifiable par grep sur les sites d'appel).
6. La console MinIO de prod n'est pas exposée publiquement (test : `curl https://<domaine-public>:9001` échoue / timeout).
7. La clé applicative `S3_ACCESS_KEY` ne peut pas créer ni supprimer le bucket (test manuel : `mc mb` et `mc rb` échouent).

### Pipeline de backup

8. `[bloquant]` `make backup-prod-dry-run` simule l'intégralité du pipeline sans écrire d'artefact ni pousser. Retourne `exit 0` et imprime un plan détaillé.
9. `[bloquant]` `make backup-prod` produit `/var/backups/badge/snapshots/snapshot-YYYY-MM-DD-HHMMSS.tar.zst.age` chiffré, non lisible sans la clé privée (`file` ne reconnaît pas le format, `tar -t` échoue).
10. `[bloquant]` Le snapshot, une fois déchiffré et extrait, contient exactement `db.sql.gz`, `minio/`, `env.production`, `Caddyfile`, `metadata.json`. Le nombre d'objets dans `minio/` correspond à `metadata.bucketObjectCount`.
11. `[bloquant]` Aucun fichier en clair ne subsiste sur le disque après `make backup-prod` (vérifiable par `ls /var/backups/badge/staging/` vide).
12. `[bloquant]` Le snapshot est poussé sur Hetzner (`rclone ls hetzner:badge-backups/` le voit) avec une taille identique au local (à l'octet près).
13. `[bloquant]` La rotation GFS supprime ce qui sort de `4 hebdo + 6 mensuels` côté local **et** distant. Testable en injectant 20 snapshots fictifs.
14. `[bloquant]` Un email est envoyé à `BACKUP_NOTIFY_EMAIL` à chaque exécution, succès ou échec.
15. `[bloquant]` `/var/backups/badge/last-status.json` est mis à jour à chaque exécution avec un JSON valide.
16. `[bloquant]` `/var/log/badge/backup.log` reçoit des lignes JSON valides (`jq -c . < backup.log` passe). Événements minimum : `backup.start`, `backup.db.dumped`, `backup.minio.mirrored`, `backup.packed`, `backup.pushed`, `backup.rotated` (×2), `backup.complete`.
17. `[bloquant]` `logrotate -d /etc/logrotate.d/badge-backup` ne signale aucune erreur.
18. `[bloquant]` Le cron `/etc/cron.d/badge-backup` est en place et déclenche `make backup-prod` dimanche 03h00.
19. Si l'étape MinIO échoue (test : couper le service minio), le script s'arrête, écrit l'erreur, envoie un email d'échec, et **ne pousse pas** un snapshot tronqué vers Hetzner.

### Restore

20. `[bloquant]` `make restore-from-backup` sans argument liste local + distant et propose un choix interactif.
21. `[bloquant]` Sans clé `age` privée sur le serveur, `make restore-from-backup SNAPSHOT=X` échoue proprement à l'étape déchiffrement avec un message clair.
22. `[bloquant]` Le script refuse de procéder sans confirmation `RESTORE-PROD-CONFIRM` puis `GO`.
23. `[bloquant]` Avant tout écrasement, un snapshot `pre-restore-YYYY-MM-DD-HHMMSS.tar.zst.age` est créé sur local + Hetzner, **non soumis** à la rotation GFS.
24. `[bloquant]` Après restore réussi, la BDD a été remplacée intégralement, le bucket aussi (`mc ls --recursive minio-local/badge-prod | wc -l` = `metadata.bucketObjectCount`).
25. `[bloquant]` `.env.production` et `Caddyfile` **ne sont pas** écrasés automatiquement. À la place, des fichiers `.restored` sont posés à côté et un diff est imprimé.
26. `[bloquant]` `make smoke-tests` passe après restore.
27. `[bloquant]` Un `ActivityLog` de type `BACKUP_RESTORE` est créé dans la BDD post-restore, avec snapshot source, opérateur, date.
28. `[bloquant]` `DRY_RUN=1 make restore-from-backup SNAPSHOT=X` déchiffre, extrait, valide l'intégrité, mais ne touche ni à la BDD ni au bucket. `exit 0` si valide, sinon `exit > 0` avec diagnostic.
29. `bash scripts/test-restore.sh` (manuel trimestriel) lance `docker-compose.restore-test.yml`, restaure le dernier snapshot dedans, exécute les smoke tests contre cet env, émet un rapport, et détruit l'env. Aucune trace sur la prod.

### Sécurité

30. `[bloquant]` `/etc/badge/age-recipients.txt` contient **au moins 2 destinataires** (`wc -l` en ignorant commentaires). Échec sinon avec message clair au démarrage du script.
31. `[bloquant]` Aucun fichier `*-identity.txt` ni `~/.config/age/identity.txt` n'est présent en condition stable. Le script avertit (sans bloquer) s'il en trouve un.
32. `[bloquant]` Permissions filesystem conformes au tableau Sécurité. Vérifiable par `scripts/audit-permissions.sh` (retourne 0 si conforme).
33. `[bloquant]` La clé applicative MinIO ne peut pas accéder à d'autres buckets que `badge-prod` (test manuel).
34. Les credentials Hetzner (`/etc/badge/rclone.conf`) sont `0600 root:root`.

### Documentation

35. `[bloquant]` `docs/v2/specs/2026-05-31-v2-08-stockage-s3-et-backups.md` (cette spec) est commitée.
36. `[bloquant]` `docs/v2/features/stockage-fichiers-s3.md` et `docs/v2/features/backups-hebdomadaires.md` existent et sont référencés depuis `docs/v2/README.md` (entrée 8 dans le tableau des sous-spécifications).
37. `[bloquant]` `docs/v2/operations/restore.md` détaille la procédure complète, incluant le cas d'urgence.
38. `[bloquant]` `docs/v2/operations/age-keys.md` détaille création, coffre, rotation.
39. `docs/v2/features/deploiement-initial.md` est mis à jour pour renvoyer vers les nouvelles features (les commandes `make backup-prod` et `Plan de rollback` référencent maintenant le nouveau script).

### Performance et coût

40. Un backup complet en prod (bucket à 20 Go) prend moins de 15 minutes bout-en-bout.
41. La taille d'un snapshot chiffré ne dépasse pas 1,3× la taille du bucket source (compression `zstd -19` effective).
42. Le coût mensuel Hetzner Storage Box ne dépasse pas 3,20 €/mois à l'état stable (10 snapshots, ~200 Go max).

## Décisions hors-scope (renvois)

| Sujet | Renvoyé à |
|---|---|
| Logs centralisés (Graylog, Loki+Grafana, Better Stack…) | Spec future v2-09 |
| Queue de jobs asynchrones (envoi d'email, génération de PDF…) | Spec future v2-10 |
| Migration MinIO → provider cloud (AWS S3, Scaleway, R2) | Non planifié. Le SDK universel `@aws-sdk/client-s3` rend la migration trivial le jour venu. |
| URLs présignées pour téléchargement/upload direct depuis le navigateur | Non planifié. À ajouter via `@aws-sdk/s3-request-presigner` quand le volume de transfert le justifiera. |
| Exposition publique de la console MinIO (sous-domaine Caddy IP-restreint) | Non planifié. Tunnel SSH suffisant pour la phase initiale. |
| Alerte d'usage disque local | Spec future v2-09 (observabilité) |
| Custom domain par organisation | Non planifié (déjà hors-scope dans la spec maîtresse). |

## Dépendances

- **Spec v2-01** (Multi-tenancy & RBAC) : la structure de clés `orgs/{orgId}/events/{eventId}/...` repose sur l'existence des modèles `Organization` et `Event`.
- **Spec v2-06** (Notifications email) : le monitoring email réutilise les variables `PLATFORM_SMTP_*`.
- **Spec v2-07** (Déploiement initial) : la cible `make backup-prod` mentionnée dans cette spec est remplacée par celle définie ici. La procédure de rollback est mise à jour pour utiliser `make restore-from-backup`.

## Suivi

- Brainstorming : 2026-05-31
- Spec rédigée : 2026-05-31
- Self-review : à venir
- Validation utilisateur : à venir
- Plan d'implémentation (writing-plans) : à venir
