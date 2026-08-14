# Bibliotheques vendorisees

`preact-htm.mjs` : htm 3.1.1 + Preact 10 bundles (build `htm/preact/standalone`),
licence MIT — https://github.com/developit/htm

Fichier **vendorise volontairement** : le studio est un outil de developpement sans
etape de build ni dependance CDN (decision spec 18). Exports utilises : `html`,
`render`, `useState`, `useEffect`, `useCallback`, `useRef`, `useMemo`.

Mise a jour :

    curl -sL https://unpkg.com/htm@3.1.1/preact/standalone.module.js \
      -o studio/public/vendor/preact-htm.mjs
