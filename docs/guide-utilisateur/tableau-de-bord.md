# Tableau de bord

Le tableau de bord est la premiere page affichee apres la connexion (`/admin`). Il presente une vue d'ensemble de l'activite sous forme d'indicateurs chiffres. Les indicateurs visibles dependent du **role** de l'utilisateur connecte.

## Vue operateur (OPERATOR)

Un operateur ne voit que la section **"Mes scans"** avec trois indicateurs portant uniquement sur ses propres scans :

- **Total scans** : nombre total de badges scannes par l'operateur
- **Aujourd'hui** : nombre de scans effectues par l'operateur ce jour
- **Participants scannes** : nombre de participants distincts (par identifiant) scannes par l'operateur

## Vue moderateur et plus (MODERATEUR, ADMIN, SUPER_ADMIN)

A partir du role MODERATEUR, les statistiques sont **globales** a l'evenement.

### Inscriptions

- **Total** : nombre total d'inscriptions dans le systeme
- **En attente** : inscriptions avec le statut "En attente" (PENDING)
- **Validees** : inscriptions validees (APPROVED)
- **Rejetees** : inscriptions rejetees (REJECTED)

### Badges

- **Imprimes** : nombre d'inscriptions approuvees dont le badge est marque imprime
- **Non imprimes** : nombre d'inscriptions approuvees dont le badge n'est pas encore imprime
- **ALL ACCESS** : nombre d'inscriptions avec l'acces total active (toutes statuts confondus)

### Scans

- **Total scans** : nombre total de scans effectues, tous operateurs confondus
- **Aujourd'hui** : nombre de scans effectues ce jour
- **Participants scannes** : nombre de participants distincts scannes

## Vue administrateur (ADMIN, SUPER_ADMIN)

En plus des sections ci-dessus, une section **"Utilisateurs"** est visible :

- **Total** : nombre de comptes utilisateurs (hors SUPER_ADMIN)
- **Admins** : nombre d'utilisateurs avec le role ADMIN
- **Operateurs** : nombre d'utilisateurs avec le role OPERATOR

## Navigation

La barre laterale (sur ordinateur) ou le menu hamburger (sur mobile) permet d'acceder a toutes les sections de l'application. Les elements du menu varient selon votre role :

| Rubrique | Role minimum |
|----------|--------------|
| Dashboard | OPERATOR |
| Inscriptions | MODERATEUR |
| Badges | MODERATEUR |
| Scanner | OPERATOR |
| Categories | MODERATEUR |
| Evenement | ADMIN |
| Parametres | ADMIN |
| Utilisateurs | SUPER_ADMIN |
| Journal d'activite | ADMIN |
