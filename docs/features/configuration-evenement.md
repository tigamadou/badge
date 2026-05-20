# Configuration de l'evenement

## Description fonctionnelle

L'application gere un evenement unique (la ceremonie d'investiture). Les administrateurs configurent les informations de l'evenement qui sont affichees sur la page d'inscription publique, sur les badges generes et dans les emails envoyes aux participants.

## Acces

- **Role requis** : ADMIN
- **Route** : `/admin/event`

## Champs configurables

| Champ | Type | Obligatoire | Utilisation |
|-------|------|-------------|-------------|
| Titre | texte | oui | Page publique, badge, emails |
| Lieu | texte | oui | Page publique, badge |
| Date | date | oui | Page publique, badge, generation ID |
| Logo | fichier image | non | Page publique, badge, emails |

## Regles metier

- Un seul evenement existe dans le systeme (upsert : creation si inexistant, mise a jour sinon)
- Le logo est uploade via `POST /api/upload` et le chemin est stocke en base
- La date de l'evenement est utilisee dans le format de l'identifiant de badge (partie `AAMMJJ`)
- Si aucun evenement n'est configure, la page d'inscription publique n'affiche pas d'informations

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/event/page.tsx` | Page configuration evenement |
| `src/app/api/event/route.ts` | GET lecture, PUT creation/mise a jour |
| `src/components/admin/EventForm.tsx` | Composant formulaire evenement |
