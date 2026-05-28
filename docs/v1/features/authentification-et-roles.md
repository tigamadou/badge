# Authentification et roles

## Description fonctionnelle

Le systeme d'authentification permet aux operateurs et administrateurs d'acceder au panneau d'administration et au scanner QR. Il repose sur un modele de roles hierarchiques a quatre niveaux, ou chaque niveau superieur herite des permissions du niveau inferieur.

Les utilisateurs sont crees par un super administrateur et recoivent un email d'invitation avec un lien pour definir leur mot de passe.

## Mecanisme d'authentification

- **Provider** : NextAuth.js Credentials (email + mot de passe)
- **Sessions** : JWT (pas de session cote serveur)
- **Hachage** : bcrypt avec 12 rounds de salage
- **Mot de passe** : minimum 6 caracteres (controle cote client sur `/setup-password`)
- **Evenement de connexion** : une entree `USER_LOGIN` est ajoutee au journal d'activite a chaque succes de connexion

Le token JWT contient : `id`, `email`, `name`, `role`.

## Hierarchie des roles

La fonction `checkRole(userRole, requiredRole)` exposee par `src/lib/auth.ts` compare deux rangs numeriques :

| Role | Rang | Vocation |
|------|------|----------|
| OPERATOR | 1 | Scan de badges aux points de controle uniquement |
| MODERATEUR | 2 | Gestion operationnelle (inscriptions, badges, categories) |
| ADMIN | 3 | Configuration de l'evenement et des parametres systeme |
| SUPER_ADMIN | 4 | Gestion des utilisateurs et de la configuration globale |

Un role donne couvre toujours les permissions des rangs inferieurs (`>=`). Certaines actions sont neanmoins explicitement interdites au SUPER_ADMIN pour preserver la separation des roles (voir tableau ci-dessous).

## Roles et permissions

| Permission | OPERATOR | MODERATEUR | ADMIN | SUPER_ADMIN |
|------------|:--------:|:----------:|:-----:|:-----------:|
| Tableau de bord | oui | oui | oui | oui |
| Scanner les QR codes (`/scan`) | oui | oui | oui | oui |
| Voir les inscriptions | non | oui | oui | oui |
| Creer / modifier inscriptions (admin) | non | oui | oui | oui |
| Approuver / rejeter inscriptions | non | oui | oui | non |
| Marquer badge imprime (unitaire ou batch) | non | oui | oui | non |
| Generer et exporter les badges | non | oui | oui | oui |
| Gerer les categories / equipes | non | oui | oui | oui |
| Configurer l'evenement | non | non | oui | oui |
| Ouvrir / fermer les inscriptions | non | non | non | oui |
| Gerer les parametres SMTP / contact | non | non | oui | oui |
| Configurer reCAPTCHA | non | non | non | oui |
| Consulter le journal d'activite | non | non | oui | oui |
| Gerer les utilisateurs | non | non | non | oui |

> Note : le SUPER_ADMIN ne valide pas et ne rejete pas les inscriptions. Il delegue ces actions aux MODERATEUR et ADMIN pour separer responsabilites administratives et operationnelles.

## Protection des routes

Le middleware Next.js (`src/middleware.ts`) intercepte les requetes vers :
- `/admin/*` -- redirige vers `/login` si pas de session
- `/scan` -- redirige vers `/login` si pas de session

Chaque route API verifie en plus le role minimum requis via `getServerSession()` combine a `checkRole()`. En cas de role insuffisant, l'API repond `403 Accès refusé`.

## Systeme d'invitation

### Flux

1. Le super administrateur cree un utilisateur (nom, email, role) depuis `/admin/users`
2. Un token d'invitation UUID est genere avec une expiration de 48 heures
3. Un mot de passe temporaire aleatoire est hashe et stocke (l'utilisateur ne le connait pas)
4. Un email est envoye avec le lien `/setup-password?token=<token>`
5. L'utilisateur clique le lien, definit son mot de passe (>= 6 caracteres)
6. Le token est efface, l'utilisateur peut se connecter normalement
7. Une entree `USER_PASSWORD_SET` est ajoutee au journal d'activite

### Contraintes

- Le token expire apres 48 heures
- Un seul token actif par utilisateur
- Le mot de passe est hashe avec bcrypt (12 rounds) avant stockage
- Apres setup, `inviteToken` et `inviteTokenExpiry` sont remis a `null`
- La creation d'utilisateur est refusee si les informations de contact (email + telephone) ne sont pas configurees dans les parametres

## Pages concernees

| Page | Route | Description |
|------|-------|-------------|
| Connexion | `/login` | Formulaire email + mot de passe |
| Setup password | `/setup-password?token=...` | Formulaire de definition du mot de passe initial |
| Profil | `/admin/profile` | Modification nom, email, mot de passe |

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/lib/auth.ts` | Configuration NextAuth, `authOptions`, helper `checkRole` |
| `src/middleware.ts` | Protection des routes `/admin/*` et `/scan` |
| `src/app/login/page.tsx` | Page de connexion |
| `src/app/setup-password/page.tsx` | Page setup mot de passe |
| `src/app/admin/profile/page.tsx` | Page profil utilisateur connecte |
| `src/app/api/auth/[...nextauth]/route.ts` | Handler NextAuth |
| `src/app/api/setup-password/route.ts` | Endpoint setup password |
| `src/app/api/profile/route.ts` | Endpoint profil (GET / PATCH) |
| `src/app/api/profile/password/route.ts` | Endpoint changement mot de passe |
| `src/types/next-auth.d.ts` | Extension types NextAuth (`id`, `role`) |
