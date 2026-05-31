# Guide utilisateur

Ce guide est destine aux operateurs, moderateurs et administrateurs qui utilisent l'application Badge au quotidien.

## Roles et permissions

L'application definit quatre roles hierarchiques. Chaque role herite des permissions du niveau inferieur.

**Operateur** (niveau 1)
- Tableau de bord limite a ses propres scans
- Scanner les QR codes des badges aux points de controle
- Gerer son profil

**Moderateur** (niveau 2 -- tout ce que peut faire un operateur, plus :)
- Consulter et gerer les inscriptions (creer, approuver, rejeter, supprimer)
- Consulter et gerer les badges (apercu, telechargement, marquage imprime, export PDF)
- Gerer les categories de participants
- Voir le tableau de bord global

**Administrateur** (niveau 3 -- tout ce que peut faire un moderateur, plus :)
- Configurer les informations de l'evenement (titre, lieu, date, logo)
- Gerer les parametres systeme (SMTP, contact)
- Consulter le journal d'activite

**Super Administrateur** (niveau 4 -- tout ce que peut faire un administrateur, plus :)
- Gerer les comptes utilisateurs (creation, modification, suppression)
- Ouvrir ou fermer les inscriptions publiques (champ `registrationOpen`)
- Configurer la cle secrete reCAPTCHA
- Ne peut pas approuver, rejeter, supprimer une inscription ni imprimer un badge (separation des roles)

## Sommaire

1. [Connexion et profil](connexion.md) -- Se connecter, premiere connexion, gerer son profil
2. [Tableau de bord](tableau-de-bord.md) -- Vue d'ensemble et indicateurs (3 vues selon role)
3. [Inscriptions](inscriptions.md) -- Consulter, approuver, rejeter, creer des inscriptions
4. [Badges](badges.md) -- Generer, previsualiser, imprimer les badges
5. [Scanner QR](scanner.md) -- Utiliser le scanner aux points de controle
6. [Journal d'activite](journal-activite.md) -- Consulter les logs d'actions
7. [Categories](categories.md) -- Gerer les categories de participants
8. [Evenement](evenement.md) -- Configurer les informations de l'evenement
9. [Utilisateurs](utilisateurs.md) -- Gerer les comptes (super administrateur)
10. [Parametres](parametres.md) -- Configurer l'envoi d'emails et les contacts
