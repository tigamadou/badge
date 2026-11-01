# reCAPTCHA v3 (formulaires publics)

Protection anti-spam de cinq formulaires publics : **inscription** (`/register`), **mot de passe
oublié** (`/forgot-password`), **réinitialisation du mot de passe** (`/reset-password/[token]`),
**définition du mot de passe** après une invitation (`/setup-password`) et **inscription à un
événement** (`/e/[slug]/register`). Version **v3** (jeton invisible avec un score) : une clé v2 ne convient pas.

## Configuration

Dans les **paramètres de la plateforme** (`/platform/settings?tab=security`, onglet « Sécurité ») : interrupteur
`recaptchaEnabled`, clé du site (`recaptchaSiteKey`) et clé secrète (`recaptchaSecretKey`, SUPER_ADMIN
uniquement, jamais renvoyée par l'API). Ce sont des clés **v3** créées dans la console Google, avec le
domaine de l'environnement dans la liste des domaines autorisés.

## Fonctionnement

1. Les layouts de `src/app/register`, `src/app/forgot-password`, `src/app/reset-password` et
   `src/app/setup-password`, et la page `/e/[slug]/register` (qui enveloppe son formulaire dans
   `RecaptchaScope`), lisent la configuration publique (`getPlatformPublicRecaptcha`, sans le secret) et la donnent aux pages par un
   contexte (`RecaptchaScope` → `RecaptchaProvider`, `src/components/auth/`). Les pages sont des
   composants client : elles ne lisent pas la base.
2. Si l'option est active, le script `https://www.google.com/recaptcha/api.js?render=<clé>` est chargé à
   l'affichage du formulaire.
3. À l'envoi, `useRecaptcha().execute(action)` demande un jeton (actions `register`,
   `forgot_password`, `reset_password`, `setup_password` et `event_register`) et le formulaire l'envoie dans `recaptchaToken`.
4. Le serveur (`verifyRecaptcha`, `src/lib/recaptcha.ts`) interroge `siteverify` et refuse sans jeton
   (`RECAPTCHA_MISSING_TOKEN`), avec un score inférieur à 0,5 (`RECAPTCHA_LOW_SCORE`), sur refus de
   Google (`RECAPTCHA_REJECTED`) ou erreur réseau (`RECAPTCHA_NETWORK`). Le message affiché est
   « Vérification reCAPTCHA refusée. » ; le code est dans la réponse JSON.

Option désactivée : aucun script n'est chargé et le champ `recaptchaToken` n'est pas envoyé.

Sur `setup-password` et `reset-password`, la vérification passe **avant** la consultation du lien : un
refus ne renseigne pas sur sa validité. Sur l'inscription à un événement
(`POST /api/events/[slug]/register`, réservée à un participant connecté), elle passe après la lecture
du corps et avant les contrôles de profil et d'inscription. Les routes de connexion (NextAuth) et
d'inscription par le staff ne sont pas concernées.

## Diagnostiquer un refus

La raison donnée par Google (clé invalide, domaine non autorisé, jeton expiré…) est écrite dans les
**logs serveur** : `[recaptcha] verification refusee { route, code, details }`. Si le script de Google est
bloqué dans le navigateur (bloqueur de publicités, réseau d'entreprise), le formulaire affiche « La
vérification anti-spam n'a pas pu démarrer » sans appeler le serveur.

## Tests

Unitaires : `src/lib/__tests__/recaptcha.test.ts` et les tests des routes d'authentification. E2E :
`e2e/public/recaptcha.spec.ts` (script Google simulé : jeton envoyé par chacun des cinq formulaires, script
bloqué, option désactivée).
Un vrai jeton Google ne peut pas être obtenu en local ni en CI : le test de bout en bout avec de
vraies clés se fait sur l'environnement concerné.
