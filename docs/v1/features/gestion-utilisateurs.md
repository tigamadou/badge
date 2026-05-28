# Gestion des utilisateurs

## Description fonctionnelle

Le super administrateur gere les comptes des operateurs et administrateurs. Les nouveaux utilisateurs sont invites par email et definissent eux-memes leur mot de passe via un lien securise a duree limitee.

## Acces

- **Role requis** : SUPER_ADMIN
- **Route** : `/admin/users`

## Prerequis

Avant de pouvoir creer un utilisateur, les informations de contact (email + telephone) doivent etre renseignees dans les parametres systeme (`/admin/settings`). Ces informations sont integrees au mail d'invitation. Si elles manquent, le bouton "Nouvel utilisateur" est desactive et l'API repond `400`.

## Fonctionnalites

### Liste des utilisateurs

- Tableau pagine (20 par defaut, modifiable) avec colonnes : nom, email, role
- Les comptes SUPER_ADMIN ne sont pas affiches dans la liste (filtre serveur `role: { not: "SUPER_ADMIN" }`)
- Vue responsive : tableau sur desktop, cartes sur mobile
- Reponse API : `{ data, total, page, totalPages }`

### Creation d'un utilisateur

1. Clic sur le bouton "Nouvel utilisateur"
2. Remplir le formulaire : nom, email, role
3. A la validation :
   - Un token d'invitation UUID est genere (validite 48h)
   - Le compte est cree avec un mot de passe temporaire hashe et inconnu de l'utilisateur
   - Un email d'invitation est envoye avec le lien `/setup-password?token=<token>`
   - Une entree `USER_CREATED` est ajoutee au journal d'activite
4. L'utilisateur recoit l'email, clique le lien, definit son mot de passe

### Modification d'un utilisateur

- Champs modifiables : nom, email, role
- Option de redefinir le mot de passe (nouveau mot de passe defini par l'admin, hashe avec bcrypt)
- Les modifications sont appliquees immediatement
- Une entree `USER_UPDATED` est ajoutee au journal d'activite

### Suppression d'un utilisateur

- Confirmation requise avant suppression
- Impossible de se supprimer soi-meme (l'API repond `400`)
- La suppression est definitive
- Une entree `USER_DELETED` est ajoutee au journal d'activite

## Roles disponibles

| Role | Description |
|------|-------------|
| OPERATOR | Scan des QR codes uniquement |
| MODERATEUR | Gestion des inscriptions, badges et categories |
| ADMIN | + configuration de l'evenement, parametres systeme, journal d'activite |
| SUPER_ADMIN | + gestion des utilisateurs et ouverture/fermeture des inscriptions |

> Voir aussi [Authentification et roles](authentification-et-roles.md) pour le detail de la hierarchie et de chaque permission.

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/users/page.tsx` | Page gestion utilisateurs |
| `src/app/api/users/route.ts` | GET liste paginee, POST creation + invitation |
| `src/app/api/users/[id]/route.ts` | PATCH modification, DELETE suppression |
| `src/components/admin/UserForm.tsx` | Composant formulaire utilisateur |
| `src/lib/mail.ts` | Envoi du mail d'invitation (`sendUserInvitation`) |
| `src/lib/auth.ts` | Verification du role minimum `SUPER_ADMIN` |
