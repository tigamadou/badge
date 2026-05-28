# Configuration de l'evenement

## Description fonctionnelle

L'application gere un evenement unique. Les administrateurs configurent les informations de l'evenement qui sont affichees sur la page d'inscription publique, sur les badges generes et dans les emails envoyes aux participants.

L'ouverture ou la fermeture des inscriptions publiques est egalement controlee depuis cette page, mais reservee au super administrateur.

## Acces

- **Role requis** : ADMIN (lecture/modification des champs evenement)
- **Toggle "Inscriptions publiques"** : SUPER_ADMIN uniquement
- **Route** : `/admin/event`

## Champs configurables

| Champ | Type | Obligatoire | Role | Utilisation |
|-------|------|-------------|------|-------------|
| Titre | texte | oui | ADMIN | Page publique, badge, emails (sujet et en-tete) |
| Lieu | texte | oui | ADMIN | Page publique, badge |
| Date | date | oui | ADMIN | Page publique, badge, generation ID |
| Logo | fichier image | non | ADMIN | Page publique, badge, en-tete des emails |
| Inscriptions ouvertes (`registrationOpen`) | booleen | non (defaut `true`) | SUPER_ADMIN | Active ou desactive le formulaire public d'inscription |

## Regles metier

- Un seul evenement existe dans le systeme (upsert : creation si inexistant, mise a jour sinon).
- Le logo est uploade via `POST /api/upload` (type `logo`, role ADMIN minimum) et le chemin relatif est stocke en base.
- La date de l'evenement est utilisee dans le format de l'identifiant de badge (partie `AAMMJJ`, cf. `src/lib/generate-id.ts`).
- Si aucun evenement n'est configure, la page d'inscription publique n'affiche pas d'informations et `GET /api/event` retourne `null`.
- Le champ `registrationOpen` n'est pris en compte cote API que si l'appelant est SUPER_ADMIN ; un ADMIN qui le passerait dans la requete est silencieusement ignore.
- Lorsque `registrationOpen = false`, `POST /api/registrations` (creation publique) renvoie une erreur et la page publique `/` affiche un message indiquant que les inscriptions sont fermees.
- Toute modification ecrit une entree `EVENT_UPDATED` dans le journal d'activite.

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/event/page.tsx` | Page configuration evenement (recupere la session pour decider d'afficher le toggle) |
| `src/app/api/event/route.ts` | GET lecture (public), PUT creation/mise a jour (ADMIN, `registrationOpen` SUPER_ADMIN) |
| `src/components/admin/EventForm.tsx` | Composant formulaire evenement (prop `showRegistrationToggle`) |
