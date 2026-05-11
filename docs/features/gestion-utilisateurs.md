# Gestion des utilisateurs

## Description fonctionnelle

Le super administrateur gere les comptes des operateurs et administrateurs. Les nouveaux utilisateurs sont invites par email et definissent eux-memes leur mot de passe via un lien securise a duree limitee.

## Acces

- **Role requis** : SUPER_ADMIN
- **Route** : `/admin/users`

## Fonctionnalites

### Liste des utilisateurs

- Tableau avec colonnes : nom, email, role
- Filtre par role (Operateur, Administrateur, Super Administrateur)
- Les comptes SUPER_ADMIN ne sont pas affiches dans la liste
- Vue responsive : tableau sur desktop, cartes sur mobile

### Creation d'un utilisateur

1. Clic sur le bouton "Nouvel utilisateur"
2. Remplir le formulaire : nom, email, role
3. A la validation :
   - Un token d'invitation UUID est genere (validite 48h)
   - Le compte est cree sans mot de passe
   - Un email d'invitation est envoye avec le lien `/setup-password?token=<token>`
4. L'utilisateur recoit l'email, clique le lien, definit son mot de passe

### Modification d'un utilisateur

- Champs modifiables : nom, email, role
- Option de reinitialiser le mot de passe (nouveau mot de passe defini par l'admin)
- Les modifications sont appliquees immediatement

### Suppression d'un utilisateur

- Confirmation requise avant suppression
- Impossible de se supprimer soi-meme
- La suppression est definitive

## Roles disponibles

| Role | Description |
|------|-------------|
| OPERATOR | Peut consulter les inscriptions, gerer les badges, scanner |
| ADMIN | + gerer categories, evenement, parametres |
| SUPER_ADMIN | + gerer les utilisateurs |

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/users/page.tsx` | Page gestion utilisateurs |
| `src/app/api/users/route.ts` | GET liste, POST creation |
| `src/app/api/users/[id]/route.ts` | PATCH modif, DELETE suppression |
| `src/components/admin/UserForm.tsx` | Composant formulaire utilisateur |
| `src/lib/mail.ts` | Envoi email d'invitation |
