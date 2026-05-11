# Authentification et roles

## Description fonctionnelle

Le systeme d'authentification permet aux operateurs et administrateurs d'acceder au panneau d'administration et au scanner QR. Il repose sur un modele de roles hierarchiques a trois niveaux, ou chaque niveau superieur herite des permissions du niveau inferieur.

Les utilisateurs sont crees par un super administrateur et recoivent un email d'invitation avec un lien pour definir leur mot de passe.

## Mecanisme d'authentification

- **Provider** : NextAuth.js Credentials (email + mot de passe)
- **Sessions** : JWT (pas de session cote serveur)
- **Hachage** : bcrypt avec 12 rounds de salage
- **Mot de passe** : minimum 6 caracteres

Le token JWT contient : `id`, `email`, `name`, `role`.

## Roles et permissions

| Permission | OPERATOR | ADMIN | SUPER_ADMIN |
|------------|----------|-------|-------------|
| Tableau de bord | oui | oui | oui |
| Voir les inscriptions | oui | oui | oui |
| Creer/modifier inscriptions | oui | oui | oui |
| Approuver/rejeter inscriptions | oui | oui | oui |
| Voir et gerer les badges | oui | oui | oui |
| Scanner les QR codes | oui | oui | oui |
| Voir l'historique des scans | oui | oui | oui |
| Gerer les categories | non | oui | oui |
| Configurer l'evenement | non | oui | oui |
| Gerer les parametres | non | oui | oui |
| Gerer les utilisateurs | non | non | oui |

## Protection des routes

Le middleware Next.js (`src/middleware.ts`) intercepte les requetes vers :
- `/admin/*` -- redirige vers `/login` si pas de session
- `/scan` -- redirige vers `/login` si pas de session

Chaque route API verifie en plus le role minimum requis via `getServerSession()`.

## Systeme d'invitation

### Flux

1. Le super administrateur cree un utilisateur (nom, email, role)
2. Un token d'invitation UUID est genere avec une expiration de 48 heures
3. Un email est envoye avec le lien `/setup-password?token=<token>`
4. L'utilisateur clique le lien, definit son mot de passe
5. Le token est efface, l'utilisateur peut se connecter normalement

### Contraintes

- Le token expire apres 48 heures
- Un seul token actif par utilisateur
- Le mot de passe est hashe avec bcrypt avant stockage
- Apres setup, le token et sa date d'expiration sont mis a null

## Pages concernees

| Page | Route | Description |
|------|-------|-------------|
| Connexion | `/login` | Formulaire email + mot de passe |
| Setup password | `/setup-password` | Formulaire de definition du mot de passe initial |
| Profil | `/admin/profile` | Modification nom, email, mot de passe |

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/lib/auth.ts` | Configuration NextAuth, callbacks JWT/session |
| `src/middleware.ts` | Protection des routes |
| `src/app/login/page.tsx` | Page de connexion |
| `src/app/setup-password/page.tsx` | Page setup mot de passe |
| `src/app/admin/profile/page.tsx` | Page profil |
| `src/app/api/auth/[...nextauth]/route.ts` | Handler NextAuth |
| `src/app/api/setup-password/route.ts` | Endpoint setup password |
| `src/app/api/profile/route.ts` | Endpoint profil |
| `src/app/api/profile/password/route.ts` | Endpoint changement mot de passe |
| `src/types/next-auth.d.ts` | Extension types NextAuth (role) |
