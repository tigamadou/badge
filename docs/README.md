# Documentation - Investiture

Systeme de gestion de badges pour la ceremonie d'investiture du President de la Republique du Benin. L'application gere l'inscription des participants, l'approbation administrative, la generation de badges PDF avec QR codes, et le controle d'acces par scan.

## Documentation technique

- [Architecture](architecture.md) -- Stack, structure du projet, flux de donnees, securite
- [Installation et deploiement](installation.md) -- Docker, configuration, commandes
- [Base de donnees](base-de-donnees.md) -- Schema Prisma, modeles, migrations, seed

## Reference API

- [Vue d'ensemble](api/README.md)
- [Authentification](api/authentification.md) -- Login, setup password
- [Inscriptions](api/inscriptions.md) -- CRUD inscriptions, impression batch
- [Utilisateurs](api/utilisateurs.md) -- Gestion des comptes (SUPER_ADMIN)
- [Categories](api/categories.md) -- Gestion des categories
- [Scan](api/scan.md) -- Scan QR et historique
- [Evenement](api/evenement.md) -- Configuration de l'evenement
- [Parametres](api/parametres.md) -- SMTP et contact
- [Fichiers](api/fichiers.md) -- Upload et telechargement

## Specifications fonctionnelles et techniques

- [Inscription publique](features/inscription-publique.md)
- [Authentification et roles](features/authentification-et-roles.md)
- [Gestion des inscriptions](features/gestion-inscriptions.md)
- [Gestion des utilisateurs](features/gestion-utilisateurs.md)
- [Gestion des categories](features/gestion-categories.md)
- [Configuration de l'evenement](features/configuration-evenement.md)
- [Badges](features/badges.md)
- [Scan QR](features/scan-qr.md)
- [Notifications email](features/notifications-email.md)
- [Parametres systeme](features/parametres-systeme.md)

## Guide utilisateur

- [Introduction](guide-utilisateur/README.md)
- [Connexion et profil](guide-utilisateur/connexion.md)
- [Tableau de bord](guide-utilisateur/tableau-de-bord.md)
- [Inscriptions](guide-utilisateur/inscriptions.md)
- [Badges](guide-utilisateur/badges.md)
- [Scanner QR](guide-utilisateur/scanner.md)
- [Categories](guide-utilisateur/categories.md)
- [Evenement](guide-utilisateur/evenement.md)
- [Utilisateurs](guide-utilisateur/utilisateurs.md)
- [Parametres](guide-utilisateur/parametres.md)
