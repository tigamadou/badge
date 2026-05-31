# Reset & déploiement initial v2

> **ABANDONNÉ — 2026-05-31** : décision utilisateur de ne pas déployer la v2 en production. Le plan d'implémentation associé ([`v2-07`](../plans/2026-05-28-v2-07-deploiement-initial.md)) reste documentaire et l'outillage déjà livré (Makefile prod, `scripts/smoke-tests.ts`, `.env.production.example`, `docs/v2/installation.md`) est conservé en l'état mais ne sera pas utilisé. Cette spec n'est plus une source de vérité opérationnelle.

> **Note 2026-05-31** — Le modèle `OrgSettings` est **supprimé** : ses champs cascadables (`contactEmail`, `contactPhone`, `badgeTemplateId`) sont fusionnés dans le modèle `Organization`, qui porte désormais aussi les infos administratives (`legalName`, adresse structurée, `taxId`, `website`, `logo`). La cascade Settings reste `Event → Organization → Platform`. Cette spec et le schéma listé ci-dessous reflètent ce changement.

## Description fonctionnelle

La v2 part d'une base de données vide : pas de migration depuis v1. La prod existante (BDD `badge` + uploads) est **réinitialisée complètement** lors du déploiement v2. Cette sous-spec décrit la procédure de reset, le seed initial, les variables d'environnement et les tests de fumée.

## Périmètre

Inclus :

- Schéma Prisma v2 complet (depuis zéro)
- Script de seed initial (`prisma/seed.ts` v2)
- Variables d'environnement v2 (ajouts par rapport à v1)
- Procédure de déploiement
- Script de smoke tests
- Plan de rollback

Exclu :

- Migration de données v1 → v2 (volontairement abandonnée)
- CI/CD automation (à voir hors-spec)

## Schéma Prisma v2

Le schéma est intégralement remplacé. Aucune migration incrémentale depuis v1 — on supprime tout et on régénère.

Tables présentes dans le schéma v2 :

- `User` (avec `isStaff`, `staffRole`, `archived`)
- `Organization` (avec infos administratives — `legalName`, adresse structurée, `taxId`, `website`, `logo`, `contactEmail`, `contactPhone`, `badgeTemplateId` — quotas, `archived`)
- `OrgMembership` (User × Org × OrgRole)
- `Event` (avec `orgId`, `slug` global unique, `archived`)
- `EventMembership` (User × Event × EventRole)
- `Category` (anciennement Team, scope event)
- `CategoryTemplate` (scope org)
- `Registration` (avec `eventId`, `categoryId`)
- `SubmissionSnapshot`
- `BlockedEmail` (scope event)
- `BlockedDocument` (scope event)
- `PlatformSettings` (singleton)
- `EventSettings` (par event)
- `ActivityLog` (avec `orgId`, `eventId`, `staffActor`)

> Le modèle `OrgSettings` n'existe plus en v2 (fusion dans `Organization` — décision 2026-05-31). Seuls `PlatformSettings` (singleton) et `EventSettings` (par event) subsistent comme tables de settings dédiées.

Enums : `StaffRole`, `OrgRole`, `EventRole`, `RegistrationStatus`, `ActivityType` (étendu). L'`ActivityType` v2 ne comporte **pas** de `ORG_SETTINGS_UPDATED` (le modèle `OrgSettings` n'existe plus) : toute modification d'une organisation, y compris ses infos administratives et ses champs de contact ex-`OrgSettings`, passe par `ORG_UPDATED`.

L'ancien enum `Role` v1 (SUPER_ADMIN, ADMIN, MODERATEUR, OPERATOR) **disparaît**. Note : le nom `SUPER_ADMIN` réapparaît en v2 dans l'enum `StaffRole` avec une sémantique différente — il désigne le sommet de la hiérarchie staff applicatif (sans la restriction v1 sur les actions métier).

## Seed initial (`prisma/seed.ts` v2)

Le seed crée uniquement un **premier utilisateur SUPER_ADMIN** ; aucune org, aucun event ne sont seedés. Le SUPER_ADMIN onboard ensuite les autres staff et les clients via l'UI.

```typescript
async function main() {
  // 1. PlatformSettings singleton
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      smtpHost: process.env.PLATFORM_SMTP_HOST || 'mailpit',
      smtpPort: parseInt(process.env.PLATFORM_SMTP_PORT || '1025'),
      smtpFrom: process.env.PLATFORM_SMTP_FROM || 'noreply@badge.local',
      smtpUser: process.env.PLATFORM_SMTP_USER || '',
      smtpPassword: process.env.PLATFORM_SMTP_PASSWORD || '',
      smtpSecure: process.env.PLATFORM_SMTP_SECURE === 'true',
    },
    update: {},
  });

  // 2. Premier user SUPER_ADMIN
  const email = process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@badge.local';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'admin123';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        password: await hash(password, 12),
        name: 'Super Admin',
        isStaff: true,
        staffRole: 'SUPER_ADMIN',
      },
    });
    console.log(`SUPER_ADMIN créé : ${email}`);
  }
}
```

Aucun event, aucune category, aucune inscription créée par le seed.

## Variables d'environnement

Toutes les variables sont définies dans `.env.production` (prod) ou `docker/compose.dev.env` (dev).

### Existantes (v1, conservées)

```
DATABASE_URL=mysql://root:<pw>@mysql:3306/badge
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://<domaine>
BASE_URL=https://<domaine>           # fallback NEXTAUTH_URL pour les liens email
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...   # amorce PlatformSettings.recaptchaSiteKey si défini
RECAPTCHA_SECRET_KEY=...             # amorce PlatformSettings.recaptchaSecretKey si défini
```

> **reCAPTCHA** : la configuration vit exclusivement dans `PlatformSettings` (décision 2026-05-31, même logique que SMTP). Les variables d'env ci-dessus servent uniquement à amorcer le singleton au seed initial ; la modification ultérieure se fait via `/staff/settings`.

### Nouvelles (v2)

```
PLATFORM_SMTP_HOST=<host>
PLATFORM_SMTP_PORT=<port>
PLATFORM_SMTP_FROM=noreply@badge.<tld>
PLATFORM_SMTP_USER=<user>
PLATFORM_SMTP_PASSWORD=<password>
PLATFORM_SMTP_SECURE=true|false

SEED_SUPER_ADMIN_EMAIL=<email>      # premier SUPER_ADMIN
SEED_SUPER_ADMIN_PASSWORD=<password> # à changer immédiatement après login
```

Les anciennes `SMTP_*` et `SEED_ADMIN_*` sont remplacées par les variantes `PLATFORM_SMTP_*` et `SEED_SUPER_ADMIN_*`.

## Procédure de déploiement (downtime maintenance)

```
[1] Annoncer la maintenance (Caddyfile sert un splash si possible)
[2] Backup de précaution (au cas où, même si on reset volontairement)
    $ make backup-prod                    # mysqldump + uploads.tar.gz
[3] Stop v1
    $ make prod-down
[4] Reset BDD et uploads
    $ docker exec badge-db mysql -u root -p$MYSQL_ROOT_PASSWORD -e "DROP DATABASE badge; CREATE DATABASE badge;"
    $ docker exec badge-app rm -rf /app/uploads/*
[5] Pull code v2
    $ git pull origin main
    $ make prod-build
[6] Appliquer le schéma v2
    $ docker compose run --rm app yarn prisma db push
[7] Seed initial
    $ docker compose run --rm app yarn prisma db seed
[8] Démarrer
    $ make prod
[9] Smoke tests
    $ make smoke-tests
[10] Première connexion SUPER_ADMIN
    - Login avec SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD
    - Changer immédiatement le mot de passe via /profile
[11] Désactiver le splash maintenance
```

Durée estimée : ~15-20 minutes.

## Smoke tests (`scripts/smoke-tests.ts`)

Suite minimale qui valide les fondations :

```typescript
async function main() {
  // 1. BDD accessible et schéma à jour
  await prisma.$queryRaw`SELECT 1`;

  // 2. PlatformSettings singleton existe
  const ps = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  if (!ps) throw new Error('PlatformSettings manquant');

  // 3. Au moins un SUPER_ADMIN
  const superAdmin = await prisma.user.findFirst({
    where: { isStaff: true, staffRole: 'SUPER_ADMIN' },
  });
  if (!superAdmin) throw new Error('Aucun SUPER_ADMIN seedé');

  // 4. App répond
  const res = await fetch(`${process.env.BASE_URL}/login`);
  if (res.status !== 200) throw new Error(`Login page status ${res.status}`);

  // 5. Routes admin protégées sans session
  const res2 = await fetch(`${process.env.BASE_URL}/staff`);
  if (res2.status !== 200) throw new Error(`Expected redirect or 200 from /staff without auth, got ${res2.status}`);
  // (NextAuth redirige en 200 vers login en HTML)

  console.log('Smoke tests OK');
}
```

Commande : `make smoke-tests` (depuis le conteneur app).

## Plan de rollback

Si la procédure échoue (smoke tests rouge, app ne démarre pas, etc.) :

```
[1] Stop v2
    $ make prod-down
[2] Restore backup
    $ docker exec badge-db mysql -u root -p$MYSQL_ROOT_PASSWORD -e "DROP DATABASE badge; CREATE DATABASE badge;"
    $ docker exec -i badge-db mysql -u root -p$MYSQL_ROOT_PASSWORD badge < backup-pre-v2.sql
    $ tar -xzf uploads-pre-v2.tar.gz -C /var/lib/docker/.../uploads
[3] Checkout tag v1
    $ git checkout v1.x.x
    $ make prod-build
    $ make prod
[4] Vérifier que la v1 répond
```

Le backup est conservé au minimum 30 jours.

## Critères d'acceptation

1. `make prod-build && make prod` lance la v2 sans erreur.
2. La BDD ne contient que `PlatformSettings` + 1 `User` staff après seed.
3. Aucun fichier dans `uploads/`.
4. `/login` charge correctement.
5. Le SUPER_ADMIN seedé peut se connecter avec les variables d'env `SEED_SUPER_ADMIN_*`.
6. `/staff` est accessible après login staff.
7. `/admin/[orgId]` retourne 404 (aucun orgId valide).
8. Les smoke tests passent.
9. Le backup pré-v2 existe et est utilisable pour rollback.
10. La base contient exactement 1 user `SUPER_ADMIN` après seed initial.

## Dépendances

- Spec 1 (Multi-tenancy & RBAC) : schéma Prisma
- Spec 6 (Emails) : `PlatformSettings` SMTP
- Spec 2 (Staff) : premier login staff
